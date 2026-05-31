import { db } from '@/db';
import { favorites, articles } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export const revalidate = 0; // Don't cache favorites page

export default async function FavoritesPage() {
  const allFavorites = await db.query.favorites.findMany({
    orderBy: [desc(favorites.createdAt)],
  });

  const articleIds = allFavorites.map(f => f.articleId);

  let favoritedArticles: any[] = [];
  if (articleIds.length > 0) {
    favoritedArticles = await db.query.articles.findMany({
      where: (articles, { inArray }) => inArray(articles.id, articleIds),
      with: { source: true }
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2 border-b border-border/40 pb-4">
        <h1 className="text-3xl font-bold tracking-tight">Kaydedilenler</h1>
        <p className="text-muted-foreground">Daha sonra okumak için kaydettiğiniz haberler.</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {favoritedArticles.map((article: any) => (
          <Link key={article.id} href={`/haber/${article.id}`}>
            <Card className="h-full flex flex-col transition-all hover:shadow-lg hover:shadow-blue-500/5 group bg-background/50 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="secondary" className="capitalize text-xs">
                    {article.category.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                    Skor: {article.importanceScore}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-snug group-hover:text-blue-400 transition-colors line-clamp-3">
                  {article.titleTr}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">
                  {article.summaryTr}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      
      {favoritedArticles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">Henüz kaydedilmiş bir haber bulunmuyor.</p>
        </div>
      )}
    </div>
  );
}
