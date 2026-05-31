"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function WatchlistManager({ topics }: { topics: any[] }) {
  const [newTopic, setNewTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    setIsLoading(true);
    try {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', topic: newTopic.trim() })
      });
      setNewTopic('');
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (id: number) => {
    setIsLoading(true);
    try {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', id })
      });
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 mb-8">
      <form onSubmit={handleAdd} className="flex gap-2 max-w-md">
        <Input 
          value={newTopic}
          onChange={e => setNewTopic(e.target.value)}
          placeholder="Yeni konu ekle (Örn: Yapay Zeka)"
          disabled={isLoading}
          className="bg-background/50"
        />
        <Button type="submit" disabled={isLoading || !newTopic.trim()} className="bg-blue-600 hover:bg-blue-700">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {topics.map(topic => (
          <Badge key={topic.id} variant="secondary" className="px-3 py-1 flex items-center gap-1 text-sm bg-secondary/50">
            {topic.topic}
            <button onClick={() => handleRemove(topic.id)} disabled={isLoading} className="text-muted-foreground hover:text-red-400">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        {topics.length === 0 && <span className="text-sm text-muted-foreground italic">Henüz takip edilen konu yok.</span>}
      </div>
    </div>
  );
}
