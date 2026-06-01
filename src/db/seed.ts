import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config({ path: '.env' });

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient, { schema });

async function main() {
  console.log('Veritabanı seed işlemi başlatılıyor...');

  // Since HTTP driver doesn't support raw execute easily, we skip pgvector extension check
  // (already handled in migration or console)
  console.log('Skipping pgvector extension check for HTTP driver.');

  // 2. rss-sources.json dosyasını oku
  const sourcesPath = path.resolve(process.cwd(), 'rss-sources.json');
  if (fs.existsSync(sourcesPath)) {
    const rawData = fs.readFileSync(sourcesPath, 'utf8');
    const parsed = JSON.parse(rawData);
    
    const rssSources = [
      ...parsed.kategoriler.finans.map((s: any) => ({ ...s, category: 'finans' })),
      ...parsed.kategoriler.teknoloji.map((s: any) => ({ ...s, category: 'teknoloji' })),
      ...parsed.kategoriler.dis_politika.map((s: any) => ({ ...s, category: 'dis_politika' })),
      ...parsed.kategoriler.turkiye.map((s: any) => ({ ...s, category: 'turkiye' }))
    ];

    console.log(`Seeding ${rssSources.length} RSS sources...`);

    // Let's clear existing first
    await db.delete(schema.sources);
    
    await db.insert(schema.sources).values(
      rssSources.map((s: any) => ({
        name: s.name,
        url: s.url,
        category: s.category as 'finans' | 'teknoloji' | 'dis_politika' | 'turkiye',
        language: s.language || 'tr',
        country: s.country || 'TR',
        isActive: s.is_active ?? s.dogrulandi ?? true,
      }))
    );

    console.log('✅ RSS kaynakları başarıyla eklendi.');
  } else {
    console.error('❌ rss-sources.json bulunamadı!');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});
