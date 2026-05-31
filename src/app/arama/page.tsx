"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Akıllı Arama</h1>
        <p className="text-muted-foreground">Kelimeleri değil, anlamları arayın. Vektör tabanlı haber arşivi.</p>
      </header>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ne öğrenmek istiyorsunuz? (Örn: Çin'in elektrikli araç pazarındaki rolü)" 
            className="pl-9 bg-background/50 backdrop-blur"
          />
        </div>
        <Button type="submit" disabled={isLoading || !query.trim()} className="bg-blue-600 hover:bg-blue-700">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ara"}
        </Button>
      </form>

      {hasSearched && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Sonuçlar ({results.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((article: any) => (
              <Link key={article.id} href={`/haber/${article.id}`}>
                <Card className="h-full hover:bg-accent/50 transition-colors">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex gap-2 mb-2">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {article.category.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {new Date(article.publishedAt).toLocaleDateString('tr-TR')}
                      </Badge>
                    </div>
                    <CardTitle className="text-base line-clamp-2">{article.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-3">{article.summary}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          {results.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-sm">Aradığınız kritere uygun haber bulunamadı.</p>
          )}
        </div>
      )}
    </div>
  );
}
