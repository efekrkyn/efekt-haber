# GÖREV: Türkçe Haber + AI Yorumcu PWA — Sıfırdan, Tam, Çalışır Halde İnşa Et

Sen kıdemli bir full-stack mühendissin. Aşağıdaki uygulamanın **tamamını** sıfırdan, eksiksiz ve çalışır halde inşa et. Hiçbir yeri stub/yarım bırakma; bir karar gerekirse en üretime uygun seçeneği seç ve devam et. **Tüm kullanıcı arayüzü tamamen Türkçe** olacak (kod ve yorumlar İngilizce). Kurulumu sen yapacaksın — kullanıcıdan elle yapılandırma isteme.

---

## 0) KURULUM — `.env` dosyasını SEN oluştur

Projeyi kurar kurmaz, proje kök dizininde **aşağıdaki içerikle bir `.env` dosyası oluştur** ve `.gitignore`'a `.env` satırını ekle (asla commit etme). Değerler hazır, hiçbirini değiştirme:

```
DATABASE_URL=postgresql://neondb_owner:npg_43DaKmQhkZxL@ep-rapid-water-alfz43jn.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require
DEEPSEEK_API_KEY=sk-5b128b0fc23f482ebb1dcfd27197b529
DEEPSEEK_BASE_URL=https://api.deepseek.com
EMBEDDING_PROVIDER=local
CRON_SECRET=habersitesi_cron_9f3Kq7Lm2Xr8Vw5Tz1Bn4Yd6Pa
TZ=Europe/Istanbul
```

Notlar:
- **Veritabanı (Neon Postgres + pgvector) zaten hazır.** `CREATE EXTENSION IF NOT EXISTS vector;` daha önce çalıştırıldı; yine de migration'larda idempotent olarak tekrar çağır.
- **EMBEDDING_PROVIDER=local** → embedding'ler sunucuda yerel `Xenova/bge-m3` modeliyle üretilir, ekstra API anahtarı gerekmez.
- Bu değerleri koda gömme; her zaman `process.env` üzerinden oku.

---

## 1) Uygulamanın Özeti

Kişisel (tek kullanıcılı, kayıt/giriş YOK) bir haber uygulaması. Her gün **saat 19:30 Türkiye saatinde (16:30 UTC)** onlarca global ve Türk haber kaynağını RSS üzerinden tarar, haberleri **3 ana kategoriye** ayırır. (Bu saat, DeepSeek'in UTC 16:30–00:30 arası geçerli **off-peak indirimine** denk gelecek şekilde seçilmiştir; ağır AI çağrıları bu pencerede ucuzdur.)

- **Finans**
- **Teknoloji**
- **Dış Politika**

Her kategori için en önemli **50 haber** seçilir → toplam **150 haber**. Yabancı haberler Türkçeye **çevrilir** ve her haber **5–10 cümle** ile özetlenir. Habere tıklanınca **tam içeriğe / orijinal kaynağa** erişilir.

Uygulamanın kalbi, tüm haberlere erişebilen ve **kalıcı hafızası olan** bir **AI sohbet botu**dur. Bot: haberleri **özetler**, **yorumlar**, kullanıcıyla haber hakkında **tartışır** ve **geçmiş haberleri asla unutmaz** (vektör veritabanı + RAG sayesinde dünkü/geçen haftaki haberleri bağlam olarak çeker). AI sağlayıcısı: **DeepSeek** (OpenAI uyumlu API).

---

## 2) Teknoloji Yığını (kesin)

- **Framework:** Next.js 14+ (App Router, TypeScript), **PWA** olarak kurulabilir (`@ducanh2912/next-pwa` ile manifest + service worker).
- **Veritabanı:** PostgreSQL + **pgvector** (Neon — hazır, `.env`'deki DATABASE_URL).
- **ORM:** Drizzle ORM + drizzle-kit migration.
- **RSS:** `rss-parser`.
- **Tam metin çıkarımı:** `@extractus/article-extractor` (olmazsa orijinal URL'ye yönlendir).
- **AI (çeviri + özet + sohbet + analiz):** DeepSeek, OpenAI SDK ile (`baseURL` = `https://api.deepseek.com`, model `deepseek-chat`).
- **Embedding (RAG, ekstra anahtar YOK):** `@huggingface/transformers` (Transformers.js) ile `Xenova/bge-m3`, sunucuda yerel. `EMBEDDING_PROVIDER=openai` için soyutlama bırak.
- **Zamanlama:** Vercel Cron, `vercel.json` içinde `crons` → `30 16 * * *` (UTC = 19:30 TR; DeepSeek off-peak penceresi için), `/api/cron/refresh`'i tetikler, `CRON_SECRET` ile korunur. Tüm ağır DeepSeek pipeline çağrıları bu off-peak penceresinde (UTC 16:30–00:30) çalışmalı.
- **Stil:** Tailwind CSS + shadcn/ui, açık/koyu tema.
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
  importance_score (0-100, AI), sentiment (olumlu|olumsuz|notr),
  market_impact (yuksek|orta|dusuk|yok), topics (text[]),
  content_hash, embedding vector(1024)

daily_briefings    id, date, content_tr, created_at
weekly_reports     id, week_start, week_end, content_tr, created_at
chat_messages      id, role(user|assistant), content, cited_article_ids(int[]), created_at
favorites          id, article_id, created_at
watchlist          id, topic, created_at
reading_events     id, article_id, category, event(view|open|chat), created_at
```

pgvector index: `embedding` üzerinde HNSW (cosine).

---

## 4) Günlük İşlem Hattı — `/api/cron/refresh`

Sırayla: 1) Tüm aktif kaynakların RSS'lerini paralel çek (hatalıyı atla+logla). 2) Başlık+URL normalize → `content_hash` ile dedup. 3) DeepSeek ile her habere `importance_score` (0–100) ver, kategori doğrula. 4) Her kategoride en yüksek skorlu **50**'yi seç (toplam 150). 5) DeepSeek ile Türkçeye çevir + **5–10 cümle** özet + `title_tr`; tam metni `article-extractor` ile `full_content_tr`'ye al. 6) `sentiment`, `market_impact`, `topics[]` üret (tek JSON-mode prompt). 7) `title_tr + summary_tr`'den bge-m3 ile 1024-boyut embedding üret. 8) Yeni haberleri yaz — **eski haberler ASLA silinmez** (hafıza arşivi). 9) Günün 150 haberinden tek "Günün Brifingi" üret → `daily_briefings`. 10) Yeni haberleri watchlist konularıyla eşleştir. 11) Pazar günüyse son 7 günü sentezle → `weekly_reports`.

DeepSeek çağrılarını batch'le, rate-limit'e karşı retry/backoff ekle, maliyeti düşürmek için JSON-mode kullan.

---

## 5) AI Sohbet (RAG — "asla unutmayan hafıza") — `/api/chat` (streaming)

1) Kullanıcı mesajını bge-m3 ile embedding'e çevir. 2) pgvector'da cosine ile en alakalı geçmiş+güncel haberleri çek (top-K 8–12); tarih filtresi desteklensin ("dün", "geçen hafta"). 3) Çekilen haberleri (başlık+özet+tarih+kaynak+id) bağlam olarak DeepSeek'e ver. 4) Son N sohbet mesajını da ekle. 5) DeepSeek Türkçe yanıt üretir: özet/yorum/tartışma. 6) **Kaynak gösterimi:** yanıtın dayandığı `article_id`'leri döndür, UI'da tıklanabilir kaynak kartı göster. 7) Soru-cevabı `chat_messages`'a kaydet.

Sistem promptu: *"Sen bağımsız, analitik bir Türk haber yorumcususun. Yalnızca verilen haber bağlamına ve genel bilgine dayan; emin olmadığında belirt. Dengeli ol, kaynak göster, kullanıcıyla fikir tartışmasına gir."*

---

## 6) Özellikler (hepsini uygula)

**Çekirdek:** 3 kategori sekmesi → 50'şer haber kartı (görsel, `title_tr`, 5–10 cümle `summary_tr`, kaynak, tarih, sentiment & market_impact rozeti). Karta tıkla → detay: tam Türkçe içerik + orijinal kaynak linki + "AI ile bu haberi konuş". Her gün 19:30 (TR) otomatik yenileme.

**AI & Hafıza:** kaynak gösterimi (citations) · çoklu kaynak/yanlılık karşılaştırması ("bu olayı farklı kaynaklar nasıl sundu?") · olay zaman çizelgesi (RAG arşivinden kronolojik timeline) · proaktif AI (ana ekranda günün gelişmesi hakkında soru açıp tartışma başlatır) · trend & bağlam takibi ("bu konu geçen hafta neydi, nasıl değişti?").

**Analiz:** etki & senaryo analizi ("önümüzdeki günlerde neye yol açabilir?") · ton/duygu rozeti (olumlu/olumsuz/nötr + finansta piyasa etkisi) · konu takibi/watchlist (kullanıcı konu ekler, yeni gelişmeler ayrı sekmede toplanır).

**Kullanım & Kişiselleştirme:** akıllı arşiv araması (doğal dille anlamsal arama) · kişisel ilgi profili (`reading_events`'ten öğrenip öne çıkarır) · favoriler/kaydet · günlük AI brifingi (ana ekran üstü) · haftalık sentez raporu.

---

## 7) Sayfa/Rota Yapısı

`/` (Günün Brifingi + Proaktif AI + kişiselleştirilmiş öne çıkanlar) · `/kategori/[finans|teknoloji|dis-politika]` · `/haber/[id]` · `/sohbet` · `/arama` · `/takip` · `/kaydedilenler` · `/haftalik`. API: `/api/cron/refresh`, `/api/chat`, `/api/search`, `/api/articles`, `/api/watchlist`, `/api/favorites`, `/api/timeline`, `/api/compare`. Mobilde alt navigasyon, masaüstünde yan menü, tam responsive, PWA olarak kurulabilir.

---

## 8) RSS Kaynakları (seed — bu listeyi doğrudan kullan)

Aşağıdaki kaynakları `sources` tablosuna seed et. `✓` işaretliler canlı doğrulandı. Çalışmayanı `is_active=false` yap ve pipeline'da atla. Yabancı kaynaklar çevrilecek.

**Finans:**
- ✓ Dünya Gazetesi — https://www.dunya.com/rss (tr)
- BloombergHT — https://www.bloomberght.com/rss (tr)
- Investing.com Türkçe — https://tr.investing.com/rss/news.rss (tr)
- Para Analiz — https://www.paraanaliz.com/feed/ (tr)
- ✓ BBC Business — https://feeds.bbci.co.uk/news/business/rss.xml (en)
- CNBC Markets — https://www.cnbc.com/id/100003114/device/rss/rss.html (en)
- NYT Business — https://rss.nytimes.com/services/xml/rss/nyt/Business.xml (en)
- The Guardian Business — https://www.theguardian.com/uk/business/rss (en)
- MarketWatch — http://feeds.marketwatch.com/marketwatch/topstories/ (en)
- Yahoo Finance — https://finance.yahoo.com/news/rssindex (en)

**Teknoloji:**
- ✓ Webtekno — https://www.webtekno.com/rss.xml (tr)
- ✓ ShiftDelete — https://shiftdelete.net/feed (tr)
- ✓ DonanımHaber — https://www.donanimhaber.com/rss/tum/ (tr)
- Chip Online TR — https://www.chip.com.tr/rss (tr)
- ✓ TechCrunch — https://techcrunch.com/feed/ (en)
- The Verge — https://www.theverge.com/rss/index.xml (en)
- Ars Technica — https://feeds.arstechnica.com/arstechnica/index (en)
- Wired — https://www.wired.com/feed/rss (en)
- Engadget — https://www.engadget.com/rss.xml (en)
- MIT Technology Review — https://www.technologyreview.com/feed/ (en)
- TechRadar — https://www.techradar.com/rss (en)
- Hacker News — https://hnrss.org/frontpage (en)

**Dış Politika:**
- ✓ BBC Türkçe — https://feeds.bbci.co.uk/turkce/rss.xml (tr)
- ✓ Anadolu Ajansı (Güncel) — https://www.aa.com.tr/tr/rss/default?cat=guncel (tr)
- Anadolu Ajansı (Dünya) — https://www.aa.com.tr/tr/rss/default?cat=dunya (tr)
- DW Türkçe — https://rss.dw.com/rdf/rss-tr-all (tr)
- TRT Haber (Dünya) — https://www.trthaber.com/dunya_articles.rss (tr)
- ✓ BBC World — https://feeds.bbci.co.uk/news/world/rss.xml (en)
- ✓ Al Jazeera — https://www.aljazeera.com/xml/rss/all.xml (en)
- The Guardian World — https://www.theguardian.com/world/rss (en)
- NYT World — https://rss.nytimes.com/services/xml/rss/nyt/World.xml (en)
- France 24 — https://www.france24.com/en/rss (en)
- Euronews — https://www.euronews.com/rss (en)
- Foreign Policy — https://foreignpolicy.com/feed/ (en)

---

## 9) Aşamalı Geliştirme Planı (her faz sonunda çalışır olmalı)

- **Faz 0 — İskelet:** Next.js+TS+Tailwind+shadcn, PWA, `.env` (yukarıdaki Bölüm 0), Drizzle şeması + migration + RSS seed.
- **Faz 1 — Haber hattı (MVP):** Cron route → RSS çek → dedup → DeepSeek kategori+önemlilik+çeviri+5–10 cümle özet → DB. 3 kategori sayfası + kartlar + detay. **Uygulama burada kullanılabilir olmalı.**
- **Faz 2 — RAG hafıza + sohbet:** bge-m3 embedding, pgvector arama, `/api/chat` streaming, kaynak gösterimi, kalıcı sohbet.
- **Faz 3 — AI özellikleri:** günlük brifing, proaktif AI, etki & senaryo, ton rozeti, çoklu kaynak karşılaştırması, zaman çizelgesi.
- **Faz 4 — Kişiselleştirme & ekstra:** akıllı arşiv araması, favoriler, watchlist, ilgi profili, haftalık rapor.

---

## 10) Kabul Kriterleri

- `.env` otomatik oluşturuldu, `.env` `.gitignore`'da.
- `npm run dev` temiz çalışır, tip hatası yok.
- `drizzle-kit push` + seed ile DB kurulur; RSS kaynakları seed edilir.
- Cron route elle tetiklenince (CRON_SECRET ile) ~150 haber üretir: çevirir, özetler, embedder, kaydeder.
- AI sohbet streaming çalışır, gerçekten geçmiş haberleri (dünkü dahil) bağlam olarak çeker ve kaynak gösterir.
- Tüm UI Türkçe, responsive, PWA olarak kurulabilir.
- README: kurulum, DB, cron tetikleme, deploy adımları.

Eksik bırakma; tüm bölümleri uçtan uca çalışır halde teslim et. Belirsizliklerde en üretime uygun varsayımı seç ve README'de not düş. Kuruluma **Faz 0**'dan başla ve fazları sırayla tamamla.
