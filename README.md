# Not Defteri — Türkçe Toplantı Asistanı

Granola'dan ilham alan, **tamamen yerel çalışan** bir Türkçe yapay zeka toplantı asistanı. Google Meet / Zoom görüşmelerinizi kaydeder (veya mevcut bir kaydı yükler), Türkçe konuşmayı metne çevirir, yapılandırılmış toplantı notları ve yapılacaklar listesi çıkarır, ve toplantı içeriği hakkında soru sormanıza izin verir.

- **Ücretsiz ve yerel öncelikli**: Konuşma tanıma (faster-whisper) tamamen bilgisayarınızda çalışır, ses dosyaları hiçbir zaman dışarıya gönderilmez.
- **OpenRouter isteğe bağlı**: Notlar/özet/soru-cevap için ücretsiz bir OpenRouter modeli kullanılabilir; API anahtarı yoksa uygulama **yerel bir çıkarım yöntemiyle** (extractive fallback) çalışmaya devam eder ve bunu UI'da açıkça belirtir.
- **Gizlilik**: Ham ses OpenRouter'a asla gönderilmez, yalnızca ilgili döküm parçaları gönderilir. Harici AI çağrıları tamamen kapatılabilir.

## İçindekiler

- [Hızlı Başlangıç](#hızlı-başlangıç)
- [Kurulum Detayları](#kurulum-detayları)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Yalnızca Yerel Mod](#yalnızca-yerel-mod-openrouter-olmadan)
- [Demo Verisi](#demo-verisi)
- [Demo Yürüyüşü (Canlı Sunum)](#demo-yürüyüşü-canlı-sunum)
- [Mimari](#mimari-english-technical-notes)
- [Sorun Giderme](#sorun-giderme)
- [Testler](#testler)
- [Değerlendirme Kontrol Listesi](#değerlendirme-kontrol-listesi)

## Hızlı Başlangıç

Gereksinimler: **Node.js 20+**, **Python 3.11–3.13** (3.14 için not aşağıda), **FFmpeg**, **Git**.

```bash
git clone https://github.com/soyleremo3/Granola_Meeting_notetaker.git
cd Granola_Meeting_notetaker
npm run setup
npm run dev
```

Kurulum tamamlandığında:

- Frontend: http://localhost:3000
- Backend (API): http://localhost:8000

`npm run setup` şunları yapar: frontend bağımlılıklarını kurar (`apps/web`), backend için bir Python sanal ortamı (`.venv`) oluşturup bağımlılıkları kurar (`apps/api`), ve her iki proje için `.env` dosyalarını `.env.example`'dan kopyalar.

### FFmpeg kurulumu

- **Windows**: `winget install Gyan.FFmpeg` veya https://www.gyan.dev/ffmpeg/builds/ adresinden indirip PATH'e ekleyin.
- **macOS**: `brew install ffmpeg`
- **Linux (Debian/Ubuntu)**: `sudo apt install ffmpeg`

Kurulumu doğrulamak için: `ffmpeg -version`

### Python sürümü notu

Backend **Python 3.11–3.13** ile test edilmiştir. Çok yeni Python sürümlerinde (`faster-whisper`'ın bağımlılığı `ctranslate2`) önceden derlenmiş paket (wheel) henüz yayınlanmamış olabilir ve kurulum başarısız olabilir. Böyle bir hata alırsanız [python.org](https://www.python.org/downloads/) üzerinden Python 3.11 veya 3.12 kurup `npm run setup`'ı tekrar çalıştırın.

## Kurulum Detayları

Manuel kurulum isterseniz:

```bash
# Frontend
cd apps/web
npm install
cp .env.example .env.local

# Backend
cd ../api
python -m venv .venv
# Windows:
.venv\Scripts\pip install -r requirements.txt
# macOS/Linux:
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Ayrı ayrı çalıştırmak için:

```bash
# Terminal 1
cd apps/api && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # Windows
cd apps/api && .venv/bin/python -m uvicorn app.main:app --reload --port 8000       # macOS/Linux

# Terminal 2
cd apps/web && npm run dev
```

## Ortam Değişkenleri

### `apps/api/.env`

| Değişken | Açıklama |
|---|---|
| `WHISPER_MODEL` | Whisper model boyutu (`tiny`, `base`, `small`, `medium`, `large-v3`). CPU için `small` önerilir. |
| `WHISPER_LANGUAGE` | Varsayılan dil (`tr`). `auto` ile otomatik algılama yapılabilir. |
| `OPENROUTER_API_KEY` | OpenRouter API anahtarı. **Boş bırakılırsa uygulama yerel özet moduna geçer.** |
| `OPENROUTER_MODEL` | Kullanılacak ücretsiz model, örn. `meta-llama/llama-3.1-8b-instruct:free`. Güncel ücretsiz modeller için https://openrouter.ai/models?max_price=0 adresine bakın. |
| `ENABLE_EXTERNAL_AI` | `false` yaparak tüm dış AI çağrılarını tamamen kapatabilirsiniz (yalnızca yerel mod). |
| `FRONTEND_URL` | CORS için izin verilen frontend adresi. |
| `MAX_UPLOAD_MB` | Maksimum yükleme dosya boyutu. |

### OpenRouter API anahtarı nasıl alınır

1. https://openrouter.ai adresinde ücretsiz bir hesap oluşturun.
2. "Keys" bölümünden yeni bir API anahtarı oluşturun.
3. `apps/api/.env` dosyasında `OPENROUTER_API_KEY=...` olarak ekleyin.
4. Ücretsiz modellerden birini `OPENROUTER_MODEL` içine yazın (model isimleri zamanla değişebileceği için burada sabit bir model önerilmez, güncel listeyi kontrol edin).

### `apps/web/.env.local`

| Değişken | Açıklama |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API adresi (varsayılan `http://localhost:8000`). |

## Yalnızca Yerel Mod (OpenRouter Olmadan)

`OPENROUTER_API_KEY` boş bırakılırsa veya `ENABLE_EXTERNAL_AI=false` yapılırsa:

- Transkripsiyon yine tamamen çalışır (faster-whisper yerel).
- Özet, konular, kararlar ve yapılacaklar **basit bir yerel çıkarım algoritmasıyla** (cümle skorlama + anahtar kelime tarama) üretilir.
- Soru-cevap, BM25 benzeri yerel arama ile en alakalı döküm bölümünü döndürür.
- Arayüzde bu durum her zaman **"yerel bir çıkarım yöntemiyle oluşturuldu"** notuyla açıkça belirtilir; hiçbir zaman bir AI özeti gibi sunulmaz.

## Demo Verisi

```bash
npm run seed:demo    # Bir örnek Türkçe toplantı ekler (özet, döküm, yapılacaklar dahil)
npm run clear:demo   # Demo verisini kaldırır
```

Demo toplantılar `is_demo: true` ile işaretlenir ve arayüzde "Demo" etiketiyle gösterilir. Uygulama varsayılan olarak **boş** başlar; sahte veri yalnızca bu komut açıkça çalıştırıldığında görünür.

## Demo Yürüyüşü (Canlı Sunum)

Kısa bir değerlendirme videosu için önerilen adımlar:

1. `npm run dev` ile uygulamayı başlatın, http://localhost:3000 açın.
2. Boş durumu gösterin ("Henüz toplantı yok").
3. "Yeni Toplantı" → "Dosya Yükle" ile [docs/demo-script.md](docs/demo-script.md) içindeki örnek metni kendi sesinizle okuyup kaydedin (herhangi bir ses kaydedici ile) ya da doğrudan mikrofon kaydını kullanın.
4. İşleme aşamalarının (dosya hazırlanıyor → dönüştürülüyor → metne çevriliyor → notlar → yapılacaklar → kaydediliyor) gerçek zamanlı ilerlediğini gösterin.
5. Özet, Konuşma Metni, Yapılacaklar ve Soru-Cevap sekmelerini gezin.
6. Bir soru sorun (örn. "Hangi kararlar alındı?") ve grounded cevabı gösterin.
7. Bir yapılacak öğesini tamamlandı işaretleyin, manuel bir görev ekleyin.
8. Dışa Aktar menüsünden dökümü `.txt` olarak indirin.
9. Toplantı geçmişine dönüp arama/filtreleme özelliğini gösterin.

Alternatif olarak `npm run seed:demo` ile hazır bir örnek toplantı yükleyip doğrudan detay sayfasını gösterebilirsiniz.

## Mimari (English technical notes)

```
apps/
  web/    Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (Base UI primitives)
  api/    FastAPI + SQLAlchemy + SQLite + faster-whisper + httpx (OpenRouter client)
scripts/  Cross-platform setup/dev/seed helper scripts (Node)
docs/     Demo script and supplementary docs
```

**Processing pipeline** (`apps/api/app/services/pipeline.py`): upload → ffmpeg conversion to 16kHz mono WAV → faster-whisper transcription (segments persisted to SQLite **before** any AI call, so a later failure never loses transcription work) → OpenRouter analysis (or local fallback) → action-item extraction (or local fallback) → ready. Each stage updates `Meeting.processing_stage`, polled by the frontend every 2s for truthful, non-fabricated progress.

**Structured AI output**: LLM responses are requested as JSON matching a Pydantic schema (`AnalysisLLMResult`, `ActionItemListLLM`). One repair attempt is made on parse failure; if that also fails, the local fallback is used — malformed JSON is never persisted, and raw model errors are never shown to the user.

**Grounded Q&A** (`apps/api/app/services/qa.py`): transcript segments are chunked and ranked with a lightweight BM25-like scorer (no vector DB). Only the top-ranked excerpts are sent to the LLM, explicitly marked as untrusted source data in the system prompt (prompt-injection mitigation). If no relevant excerpt is found, the API returns "Bu bilgi toplantı içeriğinde bulunmuyor." without calling the LLM.

**Note on component library**: shadcn/ui in this project generation targets [Base UI](https://base-ui.com) primitives (not Radix). Polymorphic rendering uses the `render` prop (`<Button render={<Link href="/x" />}>`) instead of `asChild`; links styled as buttons use `buttonVariants()` directly on the `<Link>` per Base UI's guidance against wrapping anchors in the `Button` component.

## Sorun Giderme

**"faster-whisper kurulamıyor / ctranslate2 hata veriyor"**
Python sürümünüz çok yeni olabilir. Python 3.11–3.13 kullanın (bkz. [Python sürümü notu](#python-sürümü-notu)).

**"ffmpeg bulunamadı" hatası**
FFmpeg kurulu değil veya PATH'te değil. Yukarıdaki [FFmpeg kurulumu](#ffmpeg-kurulumu) adımlarını izleyin ve terminali yeniden başlatın.

**Ekran/sekme sesi kaydı sessiz geliyor**
Paylaşım penceresinde "Sekme sesini paylaş" kutucuğunun işaretli olduğundan emin olun. Bazı tarayıcılar/işletim sistemleri sistem sesi paylaşımını desteklemez; bu durumda "Yalnızca Mikrofon" modunu kullanın.

**Transkripsiyon çok yavaş**
`WHISPER_MODEL=tiny` veya `base` deneyin (doğruluk düşer, hız artar). GPU'nuz varsa `WHISPER_DEVICE=cuda` ve uygun `ctranslate2` derlemesini kullanabilirsiniz.

**OpenRouter isteği başarısız oluyor**
Uygulama otomatik olarak yerel çıkarım moduna düşer, çökmez. `OPENROUTER_API_KEY` ve `OPENROUTER_MODEL` değerlerini kontrol edin; ücretsiz modelin adı zamanla değişebilir, https://openrouter.ai/models?max_price=0 üzerinden güncel bir tane seçin.

**CORS hatası ("Toplantılar yüklenemedi")**
`apps/api/.env` içindeki `FRONTEND_URL` değerinin frontend'in çalıştığı adresle (varsayılan `http://localhost:3000`) birebir eşleştiğinden emin olun.

## Testler

```bash
# Backend
cd apps/api
.venv/Scripts/pytest -q      # Windows
.venv/bin/pytest -q          # macOS/Linux
.venv/Scripts/ruff check app tests

# Frontend
cd apps/web
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

## Değerlendirme Kontrol Listesi

- [x] Ekran/sekme veya mikrofon kaydı, dosya yükleme
- [x] Yerel Türkçe transkripsiyon (faster-whisper)
- [x] Zaman damgalı döküm
- [x] Yapılandırılmış Türkçe özet (AI veya açıkça etiketlenmiş yerel yedek)
- [x] Kararlar ve yapılacaklar çıkarımı
- [x] Yapılacakları düzenleme/tamamlama
- [x] Dökümana dayalı (grounded) soru-cevap
- [x] Yerel toplantı geçmişi + arama
- [x] Dışa aktarma (TXT/MD)
- [x] OpenRouter anahtarı olmadan çalışır
- [x] Ücretli servis gerektirmez
- [x] Türkçe arayüz
- [x] Testler ve build'ler geçiyor

---

**Gizlilik notu**: Tüm toplantı verileri varsayılan olarak yalnızca bilgisayarınızdaki SQLite veritabanında (`apps/api/data/granola.db`) ve dosya sisteminde (`apps/api/storage/`) saklanır. Ham ses kaydı hiçbir zaman OpenRouter'a veya başka bir dış servise gönderilmez; yalnızca soru-cevap ve analiz için ilgili döküm metni gönderilir, bunu da `ENABLE_EXTERNAL_AI=false` ile tamamen kapatabilirsiniz.
