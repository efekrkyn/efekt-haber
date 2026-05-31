import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});

export interface ProcessedArticleData {
  titleTr: string;
  summaryTr: string;
  category: 'finans' | 'teknoloji' | 'dis_politika';
  importanceScore: number;
  sentiment: 'olumlu' | 'olumsuz' | 'notr';
  marketImpact: 'yuksek' | 'orta' | 'dusuk' | 'yok';
  topics: string[];
}

export async function processArticleAI(
  originalTitle: string,
  originalSummary: string,
  fullContent: string,
  expectedCategory: string
): Promise<ProcessedArticleData | null> {
  const contentToProcess = fullContent.length > 5000 
    ? fullContent.slice(0, 5000) // Truncate to save tokens
    : (fullContent || originalSummary || originalTitle);

  const prompt = `Aşağıdaki haber metnini analiz et ve JSON formatında şu bilgileri dön:
1. "titleTr": Haber başlığının Türkçe çevirisi.
2. "summaryTr": Haberin MİNİMUM 10 CÜMLEDEN oluşan detaylı ve profesyonel Türkçe özeti.
3. "category": Haberin kategorisi (SADECE şu 3'ünden biri olabilir: "finans", "teknoloji", "dis_politika"). Eğer haberin konusu '${expectedCategory}' ile daha uyumluysa onu seç, değilsen en uygununu seç.
4. "importanceScore": Haberin önem derecesi (0 ile 100 arasında bir sayı, 100 çok önemli, 0 önemsiz).
5. "sentiment": Haberin genel duygusu (SADECE "olumlu", "olumsuz" veya "notr").
6. "marketImpact": Finansal veya genel piyasa etkisi (SADECE "yuksek", "orta", "dusuk" veya "yok").
7. "topics": Haberle ilgili 3-5 anahtar kelime veya konu başlığı (dizi/array olarak).

Haber Orijinal Başlığı: ${originalTitle}
Haber İçeriği:
${contentToProcess}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0].message.content;
    if (!content) return null;

    const data = JSON.parse(content) as ProcessedArticleData;
    return data;
  } catch (error) {
    console.error('AI Processing Error:', error);
    return null;
  }
}

export async function generateDailyBriefing(articles: any[]): Promise<string> {
  const articlesContext = articles.map(a => `- ${a.titleTr}: ${a.summaryTr}`).join('\n');
  const prompt = `Sen bağımsız ve profesyonel bir haber editörüsün. Aşağıda bugünün en önemli haberlerinin başlıkları ve özetleri var. Bunları harmanlayarak, akıcı ve profesyonel bir dille "Günün Brifingi"ni oluştur. Kullanıcıya bugünün gündemini tek bir metinde sun.
  
Haberler:
${articlesContext}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });
    return response.choices[0].message.content || '';
  } catch (err) {
    console.error('Briefing Gen Error:', err);
    return '';
  }
}

export async function generateWeeklyReport(articles: any[]): Promise<string> {
  const articlesContext = articles.map(a => `- [${a.category}] ${a.titleTr}`).join('\n');
  const prompt = `Sen bağımsız ve profesyonel bir baş editörsün. Aşağıda geçen haftanın en önemli haber başlıkları var. Bunları kategorilere (Finans, Teknoloji, Dış Politika) ayırarak, geçtiğimiz haftanın trendlerini, önemli olaylarını ve bunların olası etkilerini sentezleyen kapsamlı bir "Haftalık Değerlendirme Raporu" oluştur.
  
Geçen Haftanın Önemli Gelişmeleri:
${articlesContext}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
    });
    return response.choices[0].message.content || '';
  } catch (err) {
    console.error('Weekly Gen Error:', err);
    return '';
  }
}
