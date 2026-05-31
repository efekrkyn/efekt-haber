import { db } from '@/db';
import { articles } from '@/db/schema';
import { generateEmbedding } from './embedding';
import { sql } from 'drizzle-orm';

export interface RagResult {
  id: number;
  title: string;
  summary: string;
  category: string;
  publishedAt: Date;
  sourceId: number;
  similarity: number;
}

export async function findSimilarArticles(query: string, limit = 8): Promise<RagResult[]> {
  try {
    const queryVector = await generateEmbedding(query);
    const vectorString = `[${queryVector.join(',')}]`;

    // Perform cosine similarity search using pgvector
    // We order by vector distance ascending (cosine distance)
    const result = await db.execute(sql`
      SELECT 
        id, 
        title_tr as title, 
        summary_tr as summary, 
        category, 
        published_at as "publishedAt",
        source_id as "sourceId",
        1 - (embedding <=> ${vectorString}::vector) as similarity
      FROM ${articles}
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT ${limit}
    `);

    return result as unknown as RagResult[];
  } catch (error) {
    console.error('RAG Search Error:', error);
    return [];
  }
}
