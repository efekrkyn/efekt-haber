import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config({ path: '.env' });

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function main() {
  console.log('Veritabanı seed işlemi başlatılıyor...');

  // 1. pgvector eklentisini kur
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
  console.log('✅ pgvector extension kuruldu (idempotent).');

  // 2. rss-sources.json dosyasını oku
  const sourcesPath = path.resolve(process.cwd(), 'rss-sources.json');
  if (fs.existsSync(sourcesPath)) {
    const rawData = fs.readFileSync(sourcesPath, 'utf8');
    const parsed = JSON.parse(rawData);
    
    const rssSources = [
      ...parsed.kategoriler.finans.map((s: any) => ({ ...s, category: 'finans' })),
      ...parsed.kategoriler.teknoloji.map((s: any) => ({ ...s, category: 'teknoloji' })),
      ...parsed.kategoriler.dis_politika.map((s: any) => ({ ...s, category: 'dis_politika' }))
    ];

    console.log(`Seeding ${rssSources.length} RSS sources...`);

    // Let's clear existing first
    await db.execute(sql`TRUNCATE TABLE sources CASCADE;`);
    
    await db.insert(schema.sources).values(
      rssSources.map((s: any) => ({
        name: s.name,
        url: s.url,
        category: s.category as 'finans' | 'teknoloji' | 'dis_politika',
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
