import { db } from '@/db';
import { articles, sources } from '@/db/schema';
import { desc, asc, eq, and } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { SortSelect } from '@/components/SortSelect';

export const revalidate = 3600;

export default async function CategoryPage({ 
  params,
  searchParams
}: { 
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const sortParam = typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : 'date';
  
  // Normalize slug to db enum
  let categoryEnum: 'finans' | 'teknoloji' | 'dis_politika';
  let title = '';
  
  if (slug === 'finans') {
    categoryEnum = 'finans';
    title = 'Finans';
  } else if (slug === 'teknoloji') {
    categoryEnum = 'teknoloji';
    title = 'Teknoloji';
  } else if (slug === 'dis-politika') {
    categoryEnum = 'dis_politika';
    title = 'Dış Politika';
  } else if (slug === 'turkiye') {
    categoryEnum = 'turkiye';
    title = 'Türkiye';
  } else {
    return notFound();
  }

  // Determine sorting order
  let orderClause = [desc(articles.publishedAt)];
  if (sortParam === 'importance') {
    orderClause = [desc(articles.importanceScore)];
  } else if (sortParam === 'impact') {
    orderClause = [desc(articles.marketImpact)];
  } else if (sortParam === 'sentiment') {
    orderClause = [desc(articles.sentiment)];
  }

  const categoryArticles = await db.query.articles.findMany({
    where: eq(articles.category, categoryEnum),
    orderBy: orderClause,
    limit: 50,
    with: {
      source: true,
    }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{title} Haberleri</h1>
          <p className="text-muted-foreground">Son gelişmeler, çeviriler ve yapay zeka analizleri.</p>
        </div>
        <SortSelect />
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categoryArticles.map((article: any) => (
          <Link key={article.id} href={`/haber/${article.id}`}>
            <Card className="h-full flex flex-col transition-all hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-1 group bg-background/50 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                    Skor: {article.importanceScore}
                  </Badge>
                  {article.sentiment && (
                    <Badge variant="outline" className={
                      article.sentiment === 'olumlu' ? 'border-green-500/30 text-green-400' :
                      article.sentiment === 'olumsuz' ? 'border-red-500/30 text-red-400' :
                      'border-gray-500/30 text-gray-400'
                    }>
                      {article.sentiment}
                    </Badge>
                  )}
                  {article.marketImpact && article.marketImpact !== 'yok' && (
                    <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                      Etki: {article.marketImpact}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg leading-snug group-hover:text-blue-400 transition-colors line-clamp-3">
                  {article.titleTr}
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <span className="font-medium text-foreground/80">{article.source.name}</span>
                  <span>•</span>
                  <span>{new Date(article.publishedAt).toLocaleDateString('tr-TR')}</span>
                </div>
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
      
      {categoryArticles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">Bu kategoride henüz haber bulunmuyor.</p>
        </div>
      )}
    </div>
  );
}
