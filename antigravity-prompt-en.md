# Antigravity Build Prompt — Turkish News + AI Commentator PWA

You are a senior full-stack engineer. Build the **entire** application described below from scratch, fully working. Leave nothing as a stub; when a decision is needed, pick the most production-ready option and continue. **All user-facing UI must be in Turkish** (the end users are Turkish). Code, comments, and identifiers are in English.

---

## 1) Summary

A personal (single-user, NO sign-up/login) news app. Every day at **17:00 Turkey time (14:00 UTC)** it crawls dozens of global and Turkish news sources via RSS and sorts articles into **3 main categories**:

- **Finans** (Finance)
- **Teknoloji** (Technology)
- **Dış Politika** (Foreign Policy)

For each category, the **top 50 most important** articles are selected → **150 total**. Foreign-language articles are **translated into Turkish** and every article is summarized in **5–10 sentences**. Tapping an article opens the **full content / original source**.

The heart of the app is an **AI chatbot** with access to all news and a **persistent memory** (vector database + RAG, so it can pull yesterday's / last week's news as context). The bot:
- **summarizes** news,
- **comments/opines** on it,
- **debates** the news with the user,
- and **never forgets past news**.

AI provider: **DeepSeek** (OpenAI-compatible API).

---

## 2) Tech Stack (fixed)

- **Framework:** Next.js 14+ (App Router, TypeScript), installable **PWA** (manifest + service worker via `next-pwa` / `@ducanh2912/next-pwa`).
- **Database:** PostgreSQL + **pgvector** (Neon or Supabase Postgres).
- **ORM:** Drizzle ORM + drizzle-kit migrations.
- **RSS:** `rss-parser`.
- **Full-text extraction:** `@extractus/article-extractor` (or `cheerio` + Readability).
- **AI (translate + summarize + chat + analysis):** DeepSeek via OpenAI SDK (`baseURL: https://api.deepseek.com`, model `deepseek-chat`).
- **Embeddings (for RAG, NO EXTRA API KEY):** `@huggingface/transformers` (Transformers.js) running **`Xenova/bge-m3`** multilingual model locally on the server. Leave an abstraction so `EMBEDDING_PROVIDER=openai` can switch to OpenAI embeddings.
- **Scheduling:** Vercel Cron (`crons` in `vercel.json`/`vercel.ts`). Schedule `0 14 * * *` (UTC = 17:00 TR). Cron hits `/api/cron/refresh`, protected by `CRON_SECRET`.
- **Styling:** Tailwind CSS + shadcn/ui. Light/dark theme.
- **Data:** React Server Components + TanStack Query where needed.
- **Deploy target:** Vercel.

---

## 3) Data Model (Drizzle schema)

```
sources            # RSS sources
  id, name, url(rss), category(enum: finans|teknoloji|dis_politika),
  language, country, is_active, created_at

articles           # processed news
  id, source_id, category,
  original_title, original_summary, original_language, original_url,
  title_tr, summary_tr (5-10 sentences), full_content_tr,
  published_at, fetched_at, image_url,
  importance_score (0-100, by AI),
  sentiment (enum: olumlu|olumsuz|notr),
  market_impact (enum: yuksek|orta|dusuk|yok),   # mainly finance
  topics (text[]),          # topic tags for watchlist matching
  content_hash,             # for dedup
  embedding vector(1024)    # bge-m3 dimension

daily_briefings    # AI synthesis of the day
  id, date, content_tr, created_at

weekly_reports
  id, week_start, week_end, content_tr, created_at

chat_messages      # persistent chat history
  id, role(user|assistant), content, cited_article_ids(int[]), created_at

favorites
  id, article_id, created_at

watchlist
  id, topic, created_at

reading_events     # for personal interest profile
  id, article_id, category, event(view|open|chat), created_at
```

pgvector index: HNSW (cosine) on `embedding`.

---

## 4) Daily Pipeline — `/api/cron/refresh`

In order:

1. **Fetch:** all active `sources` RSS in parallel (rss-parser). Skip + log failures.
2. **Dedup:** normalize title + URL → `content_hash`; drop existing.
3. **Score & validate category:** feed raw items per category to DeepSeek; assign 0–100 **importance_score**; drop off-category items.
4. **Select:** top **50** per category (150 total).
5. **Translate + summarize (DeepSeek):** translate to Turkish, produce a fluent **5–10 sentence** Turkish summary, produce `title_tr`. Extract full text via `article-extractor` into `full_content_tr` (fall back to original URL if extraction fails).
6. **Enrich:** produce `sentiment`, `market_impact`, `topics[]` (DeepSeek, single JSON-mode prompt).
7. **Embed:** generate 1024-dim vector from `title_tr + summary_tr` (bge-m3); store.
8. **Persist:** write new articles. **Old articles are NEVER deleted** (memory archive).
9. **Daily briefing:** summarize the day's 150 articles into one "Günün Brifingi", store in `daily_briefings`.
10. **Watchlist match:** match new articles to tracked topics; flag matches.
11. **Weekly report:** if run on Sunday, synthesize last 7 days into `weekly_reports`.

Batch DeepSeek calls; add retry/backoff for rate limits; use JSON-mode/structured output to cut cost.

---

## 5) AI Chatbot (RAG — "never forgets")

`/api/chat` (streaming):

1. Embed the user message (bge-m3).
2. pgvector **cosine** search for most relevant past + current articles (top-K 8–12). Support date filters ("dün"/yesterday, "geçen hafta"/last week).
3. Pass retrieved articles (title + summary + date + source + id) as **context** to DeepSeek.
4. Include the last N chat messages from `chat_messages`.
5. DeepSeek replies in Turkish: summary / opinion / debate.
6. **Citations:** return the `article_id`s the answer relied on; render as clickable source cards in the UI.
7. Persist Q&A to `chat_messages`.

System prompt: *"You are an independent, analytical Turkish news commentator. Rely only on the provided news context and general knowledge; state uncertainty. Be balanced, cite sources, and engage the user in debate."* (Bot speaks Turkish.)

---

## 6) Features (build all)

**Core**
- 3 category tabs → 50 article cards each (image, `title_tr`, 5–10 sentence `summary_tr`, source, date, sentiment & market_impact badges).
- Tap card → detail page: full Turkish content + original source link + "Talk to AI about this" button.
- Auto refresh daily at 17:00.

**AI & Memory**
- **Citations:** AI lists the articles it relied on as clickable cards.
- **Multi-source / bias comparison:** "How did different sources cover this?" → AI analyzes Turkish vs global and differing leanings side by side.
- **Event timeline:** for a topic/article, build a chronological timeline from the RAG archive and visualize it.
- **Proactive AI:** on the home screen, the AI opens a question/comment about the day's biggest development and starts a debate.
- **Trend & context tracking:** answers "what was this topic last week, how did it change?" from RAG memory.

**Analysis**
- **Impact & scenario analysis:** for an article, "what might this lead to in the coming days?" → AI generates scenarios.
- **Sentiment badge:** olumlu/olumsuz/nötr + (finance) market-impact badge per article.
- **Topic watchlist:** user adds topics ("faiz", "yapay zeka düzenlemesi"); new developments are auto-collected into a dedicated tab.

**Usage & Personalization**
- **Smart archive search:** natural-language semantic search across all history ("what was there about interest rates last month").
- **Personal interest profile:** learn interests from `reading_events` and surface relevant articles on home.
- **Favorites / save:** star articles, collect in "Kaydedilenler", return to them with AI.
- **Daily AI briefing:** "Günün Brifingi" card at top of home.
- **Weekly synthesis report:** "Haftanın Özeti" — last 7 days' key developments in one report.

---

## 7) Routes

- `/` — Home: daily briefing + proactive AI card + personalized highlights.
- `/kategori/[finans|teknoloji|dis-politika]` — 50 cards.
- `/haber/[id]` — article detail + talk to AI.
- `/sohbet` — full-screen AI chat (persistent history, source cards).
- `/arama` — smart archive search.
- `/takip` — watchlist topics and matches.
- `/kaydedilenler` — favorites.
- `/haftalik` — weekly reports archive.
- API: `/api/cron/refresh`, `/api/chat`, `/api/search`, `/api/articles`, `/api/watchlist`, `/api/favorites`, `/api/timeline`, `/api/compare`.

Bottom nav on mobile, side nav on desktop. Fully responsive, installable PWA.

---

## 8) Environment Variables (generate `.env.example`)

```
DATABASE_URL=postgres://...            # Neon/Supabase + pgvector
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
EMBEDDING_PROVIDER=local               # local (bge-m3) | openai
OPENAI_API_KEY=                        # only if EMBEDDING_PROVIDER=openai
CRON_SECRET=...
TZ=Europe/Istanbul
```

---

## 9) RSS Sources

A verified, categorized seed list is provided in **`rss-sources.json`** (entries with `dogrulandi: true` were live-tested). Use it directly as seed data. Mark dead feeds `is_active=false` and skip them in the pipeline. Keep the list easy to extend (aim for 15–20 solid sources per category). Foreign sources get translated.

---

## 10) Phased Build Plan (MVP → Full)

Build in **working increments**, not all at once. The app must run at the end of every phase.

**Phase 0 — Skeleton:** Next.js + TS + Tailwind + shadcn, PWA manifest/SW, Postgres+pgvector connection, Drizzle schema + migration + RSS seed from `rss-sources.json`.

**Phase 1 — News pipeline (MVP core):** Cron route → fetch RSS → dedup → DeepSeek category+importance+translate+5–10 sentence summary → write to DB. 3 category pages + article cards + detail page. **App is usable here.**

**Phase 2 — RAG memory + chat:** bge-m3 embeddings, pgvector search, `/api/chat` streaming, citations, persistent chat history. The "never-forgets memory" becomes real here.

**Phase 3 — AI features:** daily briefing, proactive AI card, impact & scenario analysis, sentiment badges, multi-source/bias comparison, event timeline.

**Phase 4 — Personalization & extras:** smart archive search, favorites/save, watchlist topic tracking, personal interest profile, weekly synthesis report.

Phases 1–2 are the required core; 3–4 build on top.

---

## 11) Acceptance Criteria

- `npm run dev` runs cleanly; no type errors.
- Migrations + seed scripts set up the DB (`drizzle-kit push` + `seed`).
- Manually triggering the cron route (with `CRON_SECRET`) produces ~150 articles: translated, summarized, embedded, stored.
- AI chat streams and genuinely pulls past news (incl. yesterday's) as context with citations.
- All UI in Turkish, responsive, installable as PWA.
- README: setup, env, DB, cron triggering, deploy steps.

Leave nothing unfinished; deliver every section working end to end. For ambiguities, pick the most production-ready assumption and note it in the README.
