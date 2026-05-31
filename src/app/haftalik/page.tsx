import { db } from '@/db';
import { weeklyReports } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { History, Sparkles } from 'lucide-react';

export const revalidate = 3600;

export default async function WeeklyReportsPage() {
  const reports = await db.query.weeklyReports.findMany({
    orderBy: [desc(weeklyReports.createdAt)],
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2 border-b border-border/40 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-purple-400 flex items-center gap-2">
          <History className="w-8 h-8" />
          Haftalık Sentez
        </h1>
        <p className="text-muted-foreground">Her Pazar, haftanın en önemli olaylarının AI destekli geniş özeti.</p>
      </header>

      <div className="space-y-6">
        {reports.map((report) => (
          <Card key={report.id} className="border-purple-500/20 bg-purple-500/5 shadow-lg shadow-purple-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-32 h-32 text-purple-500" />
            </div>
            <CardHeader>
              <CardTitle className="text-2xl text-purple-400">
                {new Date(report.weekStart).toLocaleDateString('tr-TR')} - {new Date(report.weekEnd).toLocaleDateString('tr-TR')} Haftası
              </CardTitle>
              <CardDescription>Yapay Zeka Sentezi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {report.contentTr}
              </div>
            </CardContent>
          </Card>
        ))}

        {reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground">Henüz haftalık rapor üretilmedi. (Pazar günü güncellenir)</p>
          </div>
        )}
      </div>
    </div>
  );
}
