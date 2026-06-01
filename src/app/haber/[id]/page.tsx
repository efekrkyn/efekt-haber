import { db } from '@/db';
import { articles, favorites } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, MessageSquare, Bot } from 'lucide-react';
import { FavoriteButton } from '@/components/FavoriteButton';

export const revalidate = 3600;

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  const article = await db.query.articles.findFirst({
    where: eq(articles.id, parseInt(id)),
    with: {
      source: true,
    }
  });

  if (!article) {
    return notFound();
  }

  const existingFavorite = await db.query.favorites.findFirst({
    where: eq(favorites.articleId, parseInt(id))
  });
  const isFavorited = !!existingFavorite;

  return (
    <article className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/kategori/${article.category.replace('_', '-')}`} className={buttonVariants({ variant: "ghost", size: "icon", className: "rounded-full" })}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex flex-wrap gap-2">
            <Badge className="capitalize bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
              {article.category.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              Önem: {article.importanceScore}/100
            </Badge>
          </div>
        </div>
        <FavoriteButton articleId={article.id} initialIsFavorited={isFavorited} />
      </div>

      <header className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          {article.titleTr}
        </h1>
        <div className="flex items-center justify-between text-sm text-muted-foreground border-y border-border/40 py-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{article.source.name}</span>
            <span>•</span>
            <time>{new Date(article.publishedAt).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })}</time>
          </div>
          <a href={article.originalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
            Orijinal Kaynak <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </header>

      <section className="bg-muted/30 rounded-xl p-6 border border-border/40">
        <h3 className="flex items-center gap-2 font-semibold text-lg mb-3 text-blue-400">
          <Bot className="w-5 h-5" /> Haber Metni & AI Analizi
        </h3>
        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-lg">
          {article.summaryTr}
        </p>
      </section>



      {article.topics && article.topics.length > 0 && (
        <div className="pt-6 border-t border-border/40">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">İlgili Konular</h4>
          <div className="flex flex-wrap gap-2">
            {article.topics.map(topic => (
              <Badge key={topic} variant="secondary" className="bg-secondary/50">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-40">
        <Link href={`/sohbet?q=Bana%20şu%20haber%20hakkında%20bilgi%20ver:%20${article.titleTr}`} className={buttonVariants({ size: "lg", className: "rounded-full shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white gap-2" })}>
          <MessageSquare className="w-5 h-5" />
          AI ile Tartış
        </Link>
      </div>
    </article>
  );
}
