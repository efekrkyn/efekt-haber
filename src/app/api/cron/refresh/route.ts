import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import crypto from 'crypto';
import { extract } from '@extractus/article-extractor';
import { db } from '@/db';
import { sources, articles, dailyBriefings, weeklyReports } from '@/db/schema';
import { processArticleAI, generateDailyBriefing } from '@/lib/ai';
import { generateEmbedding } from '@/lib/embedding';
import OpenAI from 'openai';
import { inArray } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

export const maxDuration = 300; // Vercel max duration for pro/cron

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  try {
    // 1. Cron Secret Verification
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const secretParams = url.searchParams.get('secret');
    
    if (
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      secretParams !== process.env.CRON_SECRET
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('--- CRON JOB START ---');

    // 2. Fetch Active Sources
    const activeSources = await db.query.sources.findMany({
      where: (sources, { eq }) => eq(sources.isActive, true),
    });

    console.log(`Found ${activeSources.length} active sources.`);

    const parser = new Parser({
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    let allItems: any[] = [];

    // 3. Parallel RSS Fetching
    await Promise.allSettled(
      activeSources.map(async (source) => {
        try {
          const feed = await parser.parseURL(source.url);
          feed.items.forEach((item) => {
            if (item.title && item.link) {
              const contentHash = crypto
                .createHash('md5')
                .update(item.title + item.link)
                .digest('hex');

              allItems.push({
                sourceId: source.id,
                expectedCategory: source.category,
                originalLanguage: source.language,
                originalTitle: item.title,
                originalUrl: item.link,
                originalSummary: item.contentSnippet || item.content || '',
                publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
                contentHash,
              });
            }
          });
        } catch (err) {
          console.error(`Error fetching RSS for ${source.name}:`, err);
        }
      })
    );

    console.log(`Fetched total ${allItems.length} raw items.`);

    const limit = parseInt(url.searchParams.get('limit') || '40', 10);
    
    // Sort all fetched items by date (newest first) to ensure we always process the freshest news across all sources
    allItems.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    // 4. Deduplication against DB
    const hashes = allItems.map(i => i.contentHash);
    const existingArticles = hashes.length > 0 ? await db.query.articles.findMany({
      where: (articles, { inArray }) => inArray(articles.contentHash, hashes),
      columns: { contentHash: true },
    }) : [];
    
    const existingHashes = new Set(existingArticles.map(a => a.contentHash));
    // We only take a maximum of (limit * 2) new items to score. This prevents the Light AI pass from taking 10+ minutes on 200 items.
    const newItems = allItems.filter(i => !existingHashes.has(i.contentHash)).slice(0, limit * 2);

    console.log(`Found ${newItems.length} new items to process.`);

    if (newItems.length === 0) {
      return NextResponse.json({ message: 'No new articles.' });
    }

    // 5. Score and Categorize all new items (Light AI Pass)
    console.log('Running light AI pass for scoring and categorization...');
    
    // Batching to avoid rate limits (doing chunks of 20)
    const scoredItems: any[] = [];
    const chunkSize = 20;
    
    for (let i = 0; i < newItems.length; i += chunkSize) {
      const chunk = newItems.slice(i, i + chunkSize);
      
      const chunkPromises = chunk.map(async (item) => {
        try {
          const prompt = `Lütfen aşağıdaki haber başlığını ve özetini değerlendir. Bana JSON olarak şu 2 bilgiyi dön:
1. "category": Haberin kategorisi (SADECE "finans", "teknoloji", "dis_politika", "turkiye"). Eğer haberin orijinal kategorisi '${item.expectedCategory}' uygunsa onu tut.
2. "importanceScore": Haberin genel önem puanı (0-100).
Başlık: ${item.originalTitle}
Özet: ${item.originalSummary.slice(0, 300)}`;

          const resp = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          });

          const resData = JSON.parse(resp.choices[0].message.content || '{}');
          return {
            ...item,
            category: resData.category || item.expectedCategory,
            importanceScore: resData.importanceScore || 0,
          };
        } catch (err) {
          return { ...item, category: item.expectedCategory, importanceScore: 0 };
        }
      });

      const processedChunk = await Promise.all(chunkPromises);
      scoredItems.push(...processedChunk);
    }

    // 6. Select Top N items globally
    const topItems = scoredItems.sort((a, b) => b.importanceScore - a.importanceScore).slice(0, limit);

    console.log(`Selected ${topItems.length} top items across categories.`);

    // 7. Heavy AI Pass: Translate, Summarize, Extra Fields + Embedding
    const finalArticles: any[] = [];
    
    for (const item of topItems) {
      console.log(`Processing deep: ${item.originalTitle}`);
      try {
        // Extract full text if possible
        let fullContent = item.originalSummary;
        let imageUrl = null;
        try {
          const article = await extract(item.originalUrl);
          if (article) {
            fullContent = article.content || article.text || fullContent;
            imageUrl = article.image || null;
          }
        } catch (e) {
          console.warn('Extraction failed for:', item.originalUrl);
        }

        const aiData = await processArticleAI(item.originalTitle, item.originalSummary, fullContent, item.category);
        
        if (aiData) {
          const embeddingText = `${aiData.titleTr}. ${aiData.summaryTr}`;
          const embeddingVector = await generateEmbedding(embeddingText);

          finalArticles.push({
            sourceId: item.sourceId,
            category: aiData.category,
            originalTitle: item.originalTitle,
            originalSummary: item.originalSummary,
            originalLanguage: item.originalLanguage,
            originalUrl: item.originalUrl,
            titleTr: aiData.titleTr,
            summaryTr: aiData.summaryTr,
            fullContentTr: fullContent,
            publishedAt: item.publishedAt,
            imageUrl,
            importanceScore: aiData.importanceScore,
            sentiment: aiData.sentiment,
            marketImpact: aiData.marketImpact,
            topics: aiData.topics || [],
            contentHash: item.contentHash,
            embedding: embeddingVector,
          });
        }
      } catch (err) {
        console.error(`Failed heavy processing for ${item.originalUrl}:`, err);
      }
    }

    console.log(`Successfully processed ${finalArticles.length} articles. Saving to DB...`);

    // 8. Save to DB
    if (finalArticles.length > 0) {
      // Chunk inserts due to potential parameter limits
      const insertChunkSize = 10;
      for (let i = 0; i < finalArticles.length; i += insertChunkSize) {
        await db.insert(articles).values(finalArticles.slice(i, i + insertChunkSize)).onConflictDoNothing();
      }

      // 9. Generate Daily Briefing
      console.log('Generating daily briefing...');
      const briefingContent = await generateDailyBriefing(finalArticles);
      if (briefingContent) {
        await db.insert(dailyBriefings).values({
          date: new Date().toISOString().split('T')[0],
          contentTr: briefingContent,
        });
      }
    }

    // 10. Weekly Report generation (If Sunday)
    const now = new Date();
    if (now.getDay() === 0) { // 0 is Sunday
      const lastWeek = new Date();
      lastWeek.setDate(now.getDate() - 7);
      
      const weeksArticles = await db.query.articles.findMany({
        where: (articles, { gte }) => gte(articles.publishedAt, lastWeek),
        orderBy: (articles, { desc }) => [desc(articles.importanceScore)],
        limit: 100, // Top 100 of the week
      });
      
      if (weeksArticles.length > 0) {
        const weeklyReportContent = await generateWeeklyReport(weeksArticles);
        if (weeklyReportContent) {
          // Import weeklyReports at the top, assume it is exported from schema
          await db.insert(weeklyReports).values({
            weekStart: lastWeek.toISOString().split('T')[0],
            weekEnd: now.toISOString().split('T')[0],
            contentTr: weeklyReportContent
          });
          console.log('Weekly report generated');
        }
      }
    }

    console.log('--- CRON JOB COMPLETED ---');
    return NextResponse.json({ success: true, processed: finalArticles.length });
  } catch (error) {
    console.error('CRON JOB ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
