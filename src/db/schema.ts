import { 
  pgTable, 
  serial, 
  text, 
  timestamp, 
  boolean, 
  integer, 
  pgEnum, 
  date,
  index
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

// pgvector custom type definition for drizzle
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)'; // Xenova/bge-m3 produces 1024-dimensional embeddings
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  }
});

// Enums
export const categoryEnum = pgEnum('category', ['finans', 'teknoloji', 'dis_politika', 'turkiye']);
export const sentimentEnum = pgEnum('sentiment', ['olumlu', 'olumsuz', 'notr']);
export const marketImpactEnum = pgEnum('market_impact', ['yuksek', 'orta', 'dusuk', 'yok']);
export const roleEnum = pgEnum('role', ['user', 'assistant']);
export const eventEnum = pgEnum('event', ['view', 'open', 'chat']);

// Tables
export const sources = pgTable('sources', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  category: categoryEnum('category').notNull(),
  language: text('language').notNull().default('tr'),
  country: text('country').notNull().default('TR'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const articles = pgTable('articles', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').references(() => sources.id).notNull(),
  category: categoryEnum('category').notNull(),
  
  originalTitle: text('original_title').notNull(),
  originalSummary: text('original_summary'),
  originalLanguage: text('original_language').notNull().default('tr'),
  originalUrl: text('original_url').notNull(),
  
  titleTr: text('title_tr').notNull(),
  summaryTr: text('summary_tr').notNull(),
  fullContentTr: text('full_content_tr'),
  
  publishedAt: timestamp('published_at').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  imageUrl: text('image_url'),
  
  importanceScore: integer('importance_score').notNull().default(0), // 0-100
  sentiment: sentimentEnum('sentiment'),
  marketImpact: marketImpactEnum('market_impact'),
  topics: text('topics').array(),
  
  contentHash: text('content_hash').notNull().unique(), // to dedup
  embedding: vector('embedding'), // vector(1024)
}, (table) => ({
  // HNSW index on embedding for pgvector
  embeddingIndex: index('embedding_index')
    .using('hnsw', table.embedding.op('vector_cosine_ops'))
}));

export const dailyBriefings = pgTable('daily_briefings', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(), // YYYY-MM-DD format usually
  contentTr: text('content_tr').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const weeklyReports = pgTable('weekly_reports', {
  id: serial('id').primaryKey(),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  contentTr: text('content_tr').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  role: roleEnum('role').notNull(),
  content: text('content').notNull(),
  citedArticleIds: integer('cited_article_ids').array(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => articles.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  topic: text('topic').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const readingEvents = pgTable('reading_events', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').references(() => articles.id).notNull(),
  category: categoryEnum('category').notNull(),
  event: eventEnum('event').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const articlesRelations = relations(articles, ({ one }) => ({
  source: one(sources, {
    fields: [articles.sourceId],
    references: [sources.id],
  }),
}));

export const sourcesRelations = relations(sources, ({ many }) => ({
  articles: many(articles),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  article: one(articles, {
    fields: [favorites.articleId],
    references: [articles.id],
  }),
}));
