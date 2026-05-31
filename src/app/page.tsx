import { db } from '@/db';
import { dailyBriefings, articles } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Bot, Sparkles } from 'lucide-react';

export const revalidate = 3600; // revalidate every hour

export default async function HomePage() {
  // 1. Fetch latest daily briefing
  const latestBriefing = await db.query.dailyBriefings.findFirst({
    orderBy: [desc(dailyBriefings.createdAt)],
  });

  // 2. Fetch top 3 latest highlighted articles (just a quick personalized look)
  const topArticles = await db.query.articles.findMany({
    orderBy: [desc(articles.importanceScore)],
    limit: 3,
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">Günün Özeti</h1>
        <p className="text-muted-foreground">Sizin için hazırlanan günlük AI haber brifingi.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-blue-500/20 bg-blue-500/5 shadow-lg shadow-blue-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24 text-blue-500" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-blue-400">
                <Bot className="w-6 h-6" />
                Yapay Zeka Brifingi
              </CardTitle>
              <CardDescription>
                {latestBriefing ? new Date(latestBriefing.date).toLocaleDateString('tr-TR', { dateStyle: 'long' }) : 'Henüz brifing üretilmedi.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestBriefing ? (
                <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {latestBriefing.contentTr}
                </div>
              ) : (
                <p className="text-muted-foreground italic">Günün brifingi için saat 19:30'u bekleyin veya test için CRON rotasını tetikleyin.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 bg-purple-500/5 transition-all hover:bg-purple-500/10 cursor-pointer group">
            <Link href="/sohbet?q=Bana%20bugünün%20en%20önemli%20olayı%20nedir%20ve%20bizi%20nasıl%20etkileyecek%20açıklar%20mısın?">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-purple-400 group-hover:text-purple-300">
                  <Sparkles className="w-5 h-5" />
                  Proaktif AI: Günün Tartışması
                </CardTitle>
                <CardDescription>Yapay Zeka Yorumcu Gündemi Değerlendiriyor</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/90">
                  Efekt Haber'in günlük analizine göre bugün öne çıkan çok kritik gelişmeler var. Detayları öğrenmek, etkilerini ve senaryoları tartışmak için tıklayın.
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold tracking-tight">Öne Çıkan Haberler</h2>
          <div className="grid gap-4">
            {topArticles.map(article => (
              <Link key={article.id} href={`/haber/${article.id}`}>
                <Card className="transition-all hover:bg-accent/50 cursor-pointer h-full group">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex gap-2 mb-2">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {article.category.replace('_', ' ')}
                      </Badge>
                      <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/20">
                        Skor: {article.importanceScore}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm group-hover:text-blue-400 transition-colors line-clamp-2">
                      {article.titleTr}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {article.summaryTr}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {topArticles.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Henüz haber yok.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
