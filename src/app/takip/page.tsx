import { db } from '@/db';
import { watchlist } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { WatchlistManager } from '@/components/WatchlistManager';
import { findSimilarArticles } from '@/lib/rag';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export const revalidate = 0; // Dynamic page

export default async function WatchlistPage() {
  const topics = await db.query.watchlist.findMany({
    orderBy: [desc(watchlist.createdAt)]
  });

  // Fetch articles for each topic
  // Since pgvector allows semantic search, we can use findSimilarArticles for each topic.
  const topicResults: Record<string, any[]> = {};
  
  for (const t of topics) {
    const results = await findSimilarArticles(t.topic, 4); // Top 4 for each topic
    topicResults[t.topic] = results;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2 border-b border-border/40 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">İzleme Listesi</h1>
        <p className="text-muted-foreground">İlgi alanlarınıza (konu/şirket/kişi) göre size özel haber akışı.</p>
      </header>

      <WatchlistManager topics={topics} />

      <div className="space-y-10">
        {topics.map(t => (
          <section key={t.id} className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-border/20 pb-2 text-blue-400">{t.topic}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topicResults[t.topic]?.map(article => (
                <Link key={article.id} href={`/haber/${article.id}`}>
                  <Card className="h-full hover:bg-accent/50 transition-colors bg-background/50">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {new Date(article.publishedAt).toLocaleDateString('tr-TR')}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm line-clamp-2">{article.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-3">{article.summary}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {(!topicResults[t.topic] || topicResults[t.topic].length === 0) && (
                <p className="text-sm text-muted-foreground">Bu konuyla ilgili son zamanlarda haber bulunamadı.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
