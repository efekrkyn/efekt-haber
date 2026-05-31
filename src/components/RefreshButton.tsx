"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

export function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    setProgress(0);
    
    try {
      // 10'ar adetlik 3 istek atıyoruz, toplam 30 haber.
      for (let i = 1; i <= 3; i++) {
        setProgress(i);
        await fetch('/api/cron/refresh?limit=10&secret=ha', {
          method: 'POST'
        });
      }
      // Sayfayı yenileyerek yeni haberleri göster
      window.location.reload();
    } catch (error) {
      console.error("Refresh failed", error);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="w-full mt-3 bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
      onClick={handleRefresh}
      disabled={loading}
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? `Yenileniyor (${progress}/3)...` : 'Hemen Yenile'}
    </Button>
  );
}
