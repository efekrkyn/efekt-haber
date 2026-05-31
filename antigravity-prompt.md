# Antigravity Görev Promptu — Türkçe Haber + AI Yorumcu PWA

Sen kıdemli bir full-stack mühendissin. Aşağıda tarif edilen uygulamanın **tamamını** sıfırdan, çalışır halde inşa et. Eksik bıraktığın hiçbir yer kalmasın; bir karar gerekirse en sağlam/üretime uygun seçeneği seç ve devam et. Tüm kullanıcı arayüzü **tamamen Türkçe** olacak.

---

## 1) Uygulamanın Özeti

Kişisel (tek kullanıcılı, kayıt/giriş YOK) bir haber uygulaması. Her gün **saat 17:00 Türkiye saatinde (14:00 UTC)** onlarca global ve Türk haber kaynağını RSS üzerinden tarar, haberleri **3 ana kategoriye** ayırır:

- **Finans**
- **Teknoloji**
- **Dış Politika**

Her kategori için en önemli **50 haber** seçilir → toplam **150 haber**. Yabancı haberler Türkçeye **çevrilir** ve her haber **5–10 cümle** ile özetlenir. Habere tıklanınca **tam içeriğe / orijinal kaynağa** erişilir.

Uygulamanın kalbi, tüm haberlere erişebilen ve **kalıcı hafızası olan** bir **AI sohbet botu**dur. Bot:
- Haberleri **özetler**,
- **yorumlar**,
- kullanıcıyla haber hakkında **tartışır**,
- ve **geçmiş haberleri asla unutmaz** (vektör veritabanı + RAG sayesinde dünkü/geçen haftaki haberleri bağlam olarak çekebilir).

AI sağlayıcısı: **DeepSeek** (OpenAI uyumlu API).

---

## 2) Teknoloji Yığını (kesin)

- **Framework:** Next.js 14+ (App Router, TypeScript), **PWA** olarak kurulabilir (manifest + service worker; `next-pwa` veya `@ducanh2912/next-pwa`).
- **Veritabanı:** PostgreSQL + **pgvector** eklentisi (Neon veya Supabase Postgres). 
- **ORM:** Drizzle ORM + drizzle-kit migration.
- **RSS:** `rss-parser`.
- **HTML temizleme / tam metin çıkarımı:** `@extractus/article-extractor` (veya `cheerio` + Mozilla Readability).
- **AI (çeviri + özet + sohbet + analiz):** DeepSeek API, OpenAI SDK ile (`baseURL: https://api.deepseek.com`, model `deepseek-chat`).
- **Embedding (RAG için, EKSTRA API ANAHTARI GEREKTİRMEZ):** `@huggingface/transformers` (Transformers.js) ile **`Xenova/bge-m3`** çok dilli embedding modeli, sunucu tarafında yerel çalışır. (Alternatif olarak ortam değişkeniyle OpenAI embedding'e geçilebilecek bir soyutlama katmanı bırak.)
- **Zamanlama:** Vercel Cron (`vercel.json` veya `vercel.ts` içinde `crons`). Schedule: `0 14 * * *` (UTC = 17:00 TR). Cron bir API route'u (`/api/cron/refresh`) tetikler; route bir `CRON_SECRET` ile korunur.
- **Stil:** Tailwind CSS + shadcn/ui. Açık/koyu tema desteği.
- **State/Data:** React Server Components + gerektiğinde TanStack Query.
- **Deploy hedefi:** Vercel.

---

## 3) Veri Modeli (Drizzle şeması)

```
sources            # RSS kaynakları
  id, name, url(rss), category(enum: finans|teknoloji|dis_politika),
  language, country, is_active, created_at

articles           # işlenmiş haberler
  id, source_id, category, 
  original_title, original_summary, original_language, original_url,
  title_tr, summary_tr (5-10 cümle), full_content_tr,
  published_at, fetched_at, image_url,
  importance_score (0-100, AI tarafından),
  sentiment (enum: olumlu|olumsuz|notr),
  market_impact (enum: yuksek|orta|dusuk|yok),  # özellikle finans
  topics (text[]),         # konu etiketleri (watchlist eşleştirme için)
  content_hash,            # dedup için
  embedding vector(1024)   # bge-m3 boyutu

daily_briefings    # günün AI sentez bülteni
  id, date, content_tr, created_at

weekly_reports     # haftalık sentez
  id, week_start, week_end, content_tr, created_at

chat_messages      # sohbet geçmişi (kalıcı)
  id, role(user|assistant), content, cited_article_ids(int[]), created_at

favorites          # kaydedilen haberler
  id, article_id, created_at

watchlist          # takip edilen konular
  id, topic, created_at

reading_events     # kişisel ilgi profili için
  id, article_id, category, event(view|open|chat), created_at
```

pgvector index: `embedding` üzerinde HNSW (cosine).

---

## 4) Günlük İşlem Hattı (Pipeline) — `/api/cron/refresh`

Sırayla:

1. **Çek:** Tüm aktif `sources` RSS'lerini paralel çek (rss-parser). Hata veren kaynağı atla, logla.
2. **Dedup:** Başlık + URL normalize edip `content_hash` üret; mevcut olanları ele.
3. **Önemlilik & kategori doğrulama:** Her kategorideki ham haberleri DeepSeek'e ver; her habere 0–100 **importance_score** ver, kategoriye düşmeyenleri ele.
4. **Seç:** Her kategoride en yüksek skorlu **50** haberi al (toplam 150).
5. **Çevir + özetle (DeepSeek):** Yabancı haberi Türkçeye çevir, **5–10 cümlelik** akıcı Türkçe özet üret, `title_tr` üret. Mümkünse tam metni `article-extractor` ile çekip `full_content_tr` oluştur (çekilemezse orijinal URL'ye yönlendir).
6. **Zenginleştir:** `sentiment`, `market_impact`, `topics[]` üret (DeepSeek, tek prompt'ta JSON çıktı).
7. **Embedding:** `title_tr + summary_tr`'den bge-m3 ile 1024-boyut vektör üret, kaydet.
8. **Kalıcılık:** Yeni haberleri `articles`'a yaz. **Eski haberler ASLA silinmez** (hafıza arşivi).
9. **Günlük brifing:** O günün 150 haberini DeepSeek'e özetletip tek bir "Günün Brifingi" metni üret, `daily_briefings`'e yaz.
10. **Watchlist eşleştirme:** Yeni haberleri takip edilen konularla eşleştir, eşleşenleri işaretle.
11. **Haftalık rapor:** Pazar günü çalışırsa son 7 günü sentezleyip `weekly_reports`'a yaz.

DeepSeek çağrılarını batch'le ve rate-limit'e karşı retry/backoff ekle. Maliyeti düşürmek için JSON-mode/structured output kullan.

---

## 5) AI Sohbet Botu (RAG — "asla unutmayan hafıza")

`/api/chat` endpoint'i (streaming):

1. Kullanıcı mesajını embedding'e çevir (bge-m3).
2. pgvector'da **cosine similarity** ile en alakalı geçmiş + güncel haberleri çek (top-K, örn. 8–12). Tarih filtresi sorabilmeli ("dün", "geçen hafta").
3. Çekilen haberleri (başlık + özet + tarih + kaynak + id) **bağlam** olarak DeepSeek'e ver.
4. Son N sohbet mesajını da bağlama ekle (`chat_messages`).
5. DeepSeek Türkçe yanıt üretir: özet / yorum / tartışma.
6. **Kaynak gösterimi:** Yanıt hangi haberlere dayandıysa o `article_id`'leri döndür; UI'da tıklanabilir kaynak kartları olarak göster.
7. Soru-cevabı `chat_messages`'a kaydet (kalıcı).

Sistem promptu botu şöyle tanımlasın: *"Sen bağımsız, analitik bir Türk haber yorumcususun. Yalnızca sağlanan haber bağlamına ve genel bilgine dayan; emin olmadığında belirt. Yorum yaparken dengeli ol, kaynak göster, kullanıcıyla fikir tartışmasına gir."*

---

## 6) Özellikler (hepsi uygulanacak)

**Çekirdek**
- 3 kategori sekmesi → her birinde 50 haber kartı (görsel, `title_tr`, 5–10 cümle `summary_tr`, kaynak, tarih, sentiment & market_impact rozeti).
- Karta tıkla → detay sayfası: tam Türkçe içerik + orijinal kaynağa link + "AI ile bu haberi konuş" butonu.
- Her gün 17:00'de otomatik yenileme.

**AI & Hafıza**
- **Kaynak gösterimi (citations):** AI her yanıtında dayandığı haberleri tıklanabilir kart olarak listeler.
- **Çoklu kaynak / yanlılık karşılaştırması:** Bir olay için "Bu olayı farklı kaynaklar nasıl sundu?" → AI Türk vs global ve farklı eğilimleri yan yana analiz eder.
- **Olay zaman çizelgesi:** Bir konu/haber için "gelişim çizelgesi" → RAG arşivinden kronolojik timeline üretir ve görselleştirir.
- **Proaktif AI:** Ana ekranda AI, günün en önemli gelişmesi hakkında kullanıcıya bir soru/yorum açar ve tartışma başlatır.
- **Trend & bağlam takibi:** "Bu konu geçen hafta neydi, nasıl değişti?" sorularını RAG hafızasıyla yanıtlar.

**Analiz**
- **Etki & senaryo analizi:** Bir haber için "önümüzdeki günlerde neye yol açabilir?" → AI olası senaryolar üretir.
- **Ton/duygu rozeti:** Her haberde olumlu/olumsuz/nötr + (finansta) piyasa etkisi rozeti.
- **Konu takibi (watchlist):** Kullanıcı konu ekler ("faiz", "yapay zeka düzenlemesi"); yeni gelişmeler otomatik toplanıp ayrı bir sekmede sunulur.

**Kullanım & Kişiselleştirme**
- **Akıllı arşiv araması:** Doğal dille tüm geçmiş arşivde anlamsal arama ("geçen ay faiz hakkında ne vardı").
- **Kişisel ilgi profili:** `reading_events`'ten ilgi alanlarını öğrenip ana ekranda ilgili haberleri öne çıkarır.
- **Favoriler / kaydet:** Haberi yıldızla, "Kaydedilenler" sekmesinde topla, AI ile o haberlere dön.
- **Günlük AI brifingi:** Ana ekranın üstünde "Günün Brifingi" kartı.
- **Haftalık sentez raporu:** "Haftanın Özeti" — son 7 günün en önemli gelişmeleri tek raporda.

---

## 7) Sayfa/Rota Yapısı

- `/` — Ana ekran: Günün Brifingi + Proaktif AI kartı + kişiselleştirilmiş öne çıkanlar.
- `/kategori/[finans|teknoloji|dis-politika]` — 50 haber kartı.
- `/haber/[id]` — haber detayı + AI ile konuş.
- `/sohbet` — tam ekran AI sohbet (kalıcı geçmiş, kaynak kartları).
- `/arama` — akıllı arşiv araması.
- `/takip` — watchlist konuları ve eşleşen haberler.
- `/kaydedilenler` — favoriler.
- `/haftalik` — haftalık raporlar arşivi.
- API: `/api/cron/refresh`, `/api/chat`, `/api/search`, `/api/articles`, `/api/watchlist`, `/api/favorites`, `/api/timeline`, `/api/compare`.

Mobilde alt navigasyon bar, masaüstünde yan menü. Tamamen responsive, PWA olarak telefona kurulabilir.

---

## 8) Ortam Değişkenleri (`.env.example` üret)

```
DATABASE_URL=postgres://...            # Neon/Supabase + pgvector
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
EMBEDDING_PROVIDER=local               # local (bge-m3) | openai
OPENAI_API_KEY=                        # yalnızca EMBEDDING_PROVIDER=openai ise
CRON_SECRET=...                        # cron route koruması
TZ=Europe/Istanbul
```

---

## 9) RSS Kaynakları (başlangıç listesi — genişlet)

Aşağıdakileri seed olarak ekle ve **her kategoride en az 15–20 sağlam kaynağa** çıkar. Yabancı kaynaklar çevrilecek.

**Finans:** Bloomberg HT, Dünya Gazetesi, Para Analiz, Investing.com TR, Reuters Business, Bloomberg Markets, Financial Times, CNBC, WSJ Markets.
**Teknoloji:** Webtekno, ShiftDelete, Donanım Haber, TechCrunch, The Verge, Ars Technica, Wired, Engadget, MIT Tech Review.
**Dış Politika:** Anadolu Ajansı Dünya, BBC Türkçe, DW Türkçe, Reuters World, AP World, Al Jazeera, Foreign Policy, The Guardian World.

**Hazır seed dosyası:** Doğrulanmış RSS URL'leri `rss-sources.json` dosyasında verilmiştir (kategorilere ayrılmış, `dogrulandi: true` olanlar canlı test edildi). Bu dosyayı doğrudan seed olarak kullan; çalışmayan kaynağı `is_active=false` yap ve pipeline'da atla. Listeyi kolayca genişletilebilir tut.

---

## 11) Aşamalı Geliştirme Planı (MVP → Tam)

Her şeyi tek seferde değil, **çalışan halde aşama aşama** kur. Her faz sonunda uygulama çalışır durumda olmalı.

**Faz 0 — İskelet:** Next.js + TS + Tailwind + shadcn kurulumu, PWA manifest/service worker, Postgres+pgvector bağlantısı, Drizzle şeması + migration + RSS seed. `rss-sources.json`'dan kaynakları yükle.

**Faz 1 — Haber hattı (MVP çekirdeği):** Cron route → RSS çek → dedup → DeepSeek ile kategori+önemlilik+çeviri+5–10 cümle özet → DB'ye yaz. 3 kategori sayfası + haber kartları + detay sayfası. **Burada uygulama temel haliyle kullanılabilir olmalı.**

**Faz 2 — RAG hafıza + sohbet:** bge-m3 embedding üretimi, pgvector araması, `/api/chat` streaming, kaynak gösterimi (citations), kalıcı sohbet geçmişi. "Asla unutmayan hafıza" burada gerçek olur.

**Faz 3 — AI özellikleri:** Günlük brifing, proaktif AI kartı, etki & senaryo analizi, ton/duygu rozeti, çoklu kaynak/yanlılık karşılaştırması, olay zaman çizelgesi.

**Faz 4 — Kişiselleştirme & ekstra:** Akıllı arşiv araması, favoriler/kaydet, watchlist konu takibi, kişisel ilgi profili, haftalık sentez raporu.

Faz 1 ve 2 zorunlu çekirdektir; 3 ve 4 onların üzerine eklenir.

---

## 10) Kalite / Kabul Kriterleri

- `npm run dev` ile sorunsuz çalışır; tip hatası yok.
- Migration + seed script'leri ile DB kurulur (`drizzle-kit push` + `seed`).
- Cron route elle tetiklenince (CRON_SECRET ile) 3×50 = ~150 haber üretir, çevirir, özetler, embedder ve kaydeder.
- AI sohbet streaming çalışır ve gerçekten geçmiş haberleri (dünkü dahil) bağlam olarak çekip kaynak gösterir.
- Tüm UI Türkçe, responsive ve PWA olarak kurulabilir.
- README: kurulum, env, DB, cron tetikleme, deploy adımları.

Eksik bırakma; tüm bölümleri uçtan uca çalışır halde teslim et. Belirsizliklerde en üretime uygun varsayımı seç, README'de not düş.
