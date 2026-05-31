import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { findSimilarArticles } from '@/lib/rag';
import { db } from '@/db';
import { chatMessages } from '@/db/schema';

// We must use node runtime since transformers.js (used in findSimilarArticles) does not support edge runtime out of the box.
export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastUserMessage = messages[messages.length - 1].content;

    // 1. RAG Search
    const similarArticles = await findSimilarArticles(lastUserMessage, 8);
    const citedArticleIds = similarArticles.map(a => a.id);

    // 2. Build Context String
    const contextStr = similarArticles
      .map(a => `[Kaynak ID: ${a.id}] ${a.title}\nÖzet: ${a.summary}\nTarih: ${new Date(a.publishedAt).toLocaleDateString('tr-TR')}`)
      .join('\n\n');

    // 3. Prepare System Prompt
    const systemPrompt = `Sen bağımsız, analitik bir Türk haber yorumcususun. Yalnızca verilen haber bağlamına ve genel bilgine dayan; emin olmadığında belirt. Dengeli ol, kaynak göster, kullanıcıyla fikir tartışmasına gir.
Aşağıda kullanıcının sorusuyla ilgili bulduğumuz en güncel ve alakalı haber kaynakları bulunmaktadır:

---
${contextStr}
---

ÖNEMLİ KURALLAR:
1. Yanıtlarında atıf yaptığın haberlerin Kaynak ID'lerini [Kaynak: ID] şeklinde mutlaka belirt.
2. Sadece sağlanan bağlamdaki haberlere ve genel dünya tarihine dayanarak yanıt ver.
3. Kullanıcıyla etkileşime gir, soru sor, tartışma başlat.`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content }))
    ];

    // 4. Save User Message to DB (Fire & Forget)
    db.insert(chatMessages).values({
      role: 'user',
      content: lastUserMessage,
    }).execute().catch(e => console.error("DB Save Error:", e));

    // 5. Stream Response using SSE manually (since openai.chat.completions.create with stream: true returns a stream)
    const stream = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: apiMessages,
      stream: true,
      temperature: 0.6,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
        
        // Save Assistant Message to DB after stream finishes
        db.insert(chatMessages).values({
          role: 'assistant',
          content: fullResponse,
          citedArticleIds,
        }).execute().catch(e => console.error("DB Save Error:", e));
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'x-cited-articles': JSON.stringify(citedArticleIds),
      },
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
