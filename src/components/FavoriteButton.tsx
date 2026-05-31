"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FavoriteButtonProps {
  articleId: number;
  initialIsFavorited: boolean;
}

export function FavoriteButton({ articleId, initialIsFavorited }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const toggleFavorite = async () => {
    setIsLoading(true);
    const action = isFavorited ? 'remove' : 'add';
    
    // Optimistic UI
    setIsFavorited(!isFavorited);
    
    try {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, action })
      });
      router.refresh();
    } catch (err) {
      setIsFavorited(isFavorited); // Revert
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleFavorite} 
      disabled={isLoading}
      className={`rounded-full transition-colors ${isFavorited ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground'}`}
    >
      <Bookmark className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} />
    </Button>
  );
}
