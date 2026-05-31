import { db } from './index';
import { articles, sources } from './schema';
import { generateEmbedding } from '../lib/embedding';

async function run() {
  console.log('Inserting dummy articles...');
  
  // Create dummy source
  const [source] = await db.insert(sources).values({
    name: 'Haberdar Özel',
    url: 'https://haberdar.ai',
    category: 'teknoloji',
  }).returning();

  const dummyArticles = [
    {
      title: 'Yapay Zeka Devrimi Hız Kesmeden Devam Ediyor',
      summary: 'Son gelişmelere göre yapay zeka modelleri artık insan seviyesinde akıl yürütme becerilerine ulaşıyor. Uzmanlar bu durumun iş dünyasında köklü değişiklikler yaratacağını belirtiyor.',
      cat: 'teknoloji' as const,
    },
    {
      title: 'Küresel Piyasalar Haftaya Yükselişle Başladı',
      summary: 'Merkez bankalarının faiz indirim sinyalleri küresel piyasalarda bahar havası estirdi. Borsa endeksleri tüm zamanların en yüksek seviyelerini test ediyor.',
      cat: 'finans' as const,
    },
    {
      title: 'Ortadoğu\'da Yeni Diplomatik Temaslar',
      summary: 'Bölgesel gerilimi düşürmek amacıyla uluslararası heyetler yeni bir barış planı üzerinde çalışmaya başladı. Görüşmelerin olumlu bir atmosferde geçtiği bildiriliyor.',
      cat: 'dis_politika' as const,
    }
  ];

  for (const item of dummyArticles) {
    const embedding = await generateEmbedding(`${item.title} ${item.summary}`);
    
    await db.insert(articles).values({
      sourceId: source.id,
      category: item.cat,
      originalTitle: item.title,
      originalSummary: item.summary,
      originalLanguage: 'tr',
      originalUrl: 'https://haberdar.ai',
      titleTr: item.title,
      summaryTr: item.summary,
      fullContentTr: item.summary,
      publishedAt: new Date(),
      importanceScore: 95,
      sentiment: 'olumlu',
      marketImpact: 'yuksek',
      topics: ['Önemli Gelişme', item.cat],
      contentHash: `dummy-${item.cat}-${Date.now()}`,
      embedding,
    });
  }

  console.log('Dummy articles inserted successfully!');
}

run().catch(console.error).finally(() => process.exit(0));
