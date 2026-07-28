# PLAN.md — Güvenilirlik ve Ürün Kalitesi İyileştirmeleri

Bu dosya, Not Defteri (Granola TR) uygulamasında yapılan son güvenilirlik/kalite
turunun tam planını, gerekçelerini ve sonuçlarını belgeler. Mimari
değiştirilmedi (Next.js + FastAPI + SQLite + faster-whisper), hiçbir çalışan
özellik kaldırılmadı, hiçbir ücretli servis eklenmedi.

## Başlangıç durumu — çözülmesi istenen 7 problem

1. Yüklemelerde sabit MB sınırı vardı, pratik boyutta dosya yüklenemiyordu.
2. Tarayıcıdan ekran/sekme kaydı güvenilir değildi.
3. Bazı kayıtlarda video var ama ses akışı yoktu.
4. Transkripsiyon sonrası AI analiz aşaması bazen uzun süre bekleyip başarısız
   oluyordu.
5. Ham backend/FFmpeg hataları bazen kullanıcıya gösteriliyordu.
6. UI/UX kullanılabilirdi ama son bir kalite cilası gerekiyordu.
7. OpenRouter isteğe bağlı ve ücretsiz modellerle uyumlu kalmalıydı.

## Yapılan işin genel planı (5 bölüm)

### Bölüm 1 — Sınırsız, streamed yükleme

- `MAX_UPLOAD_MB` (sabit 500MB) → `MAX_UPLOAD_SIZE_MB` (varsayılan `0` = sınır
  yok).
- Dosyalar zaten 1MB'lık parçalar halinde diske yazılıyordu
  (`storage.save_upload`); bu davranış korunup limit kontrolü `0` iken
  tamamen atlanacak şekilde güncellendi. Dosya asla tam olarak bellekte
  tutulmuyor.
- Frontend: `validation.ts` içinde `maxSizeMb > 0` kontrolü, sahte "maksimum
  X MB" yazısı kaldırıldı, 500MB üstü dosyalar için Türkçe büyük-dosya
  uyarısı eklendi (`upload-panel.tsx`).
- Dosya türü doğrulama ve `sanitize_filename` (path-traversal koruması)
  korundu.
- Testler: sınırsız mod, yapılandırılmış limit, streamed okuma, boş dosya,
  geçersiz uzantı, güvenli dosya adı (`test_storage.py`, `validation.test.ts`).

### Bölüm 2 — Ekran/sekme kaydı güvenilirliği

Bu bölümün büyük kısmı **bu turdan önceki commit'lerde** zaten çözülmüştü
(`a077af7`, `0efcae8`, `bf40bd2`): `MediaRecorder.isTypeSupported()` ile MIME
seçimi, stream/recorder'ın ref'lerde tutulması, çift başlatma/durdurma
koruması, boş chunk filtreleme, native "Stop sharing" olayının düzgün
yakalanması, ses kanalı olmayan kayıtlar için `ffprobe` ile önceden kontrol
ve dostça Türkçe hata mesajı. Bu tur içinde doğrulandı, ek değişiklik
gerekmedi.

**Ek olarak, kullanıcıdan gelen gerçek bir hata raporuyla yeni bir kök neden
bulundu ve düzeltildi** (bkz. "Sonradan bulunan ve düzeltilen ek hata").

### Bölüm 3 — Analiz aşamasının dayanıklılığı (bu turun en büyük parçası)

`apps/api/app/services/analysis.py` yeniden yazıldı:

- **Açık timeout'lar**: `httpx.Timeout(connect=10s, read=60s, write=10s,
  pool=10s)` — eskiden tek düz `90s` vardı, artık hiçbir istek sınırsız
  beklemiyor.
- **Sınırlı retry**: yalnızca timeout, bağlantı hatası, HTTP 429/502/503/504
  — kısa üstel backoff ile en fazla 2 deneme.
- **Retry yok**: 401/403 (kimlik doğrulama) ve 400/422 (hatalı istek) —
  bunlar anında başarısız olup fallback'e düşer.
- **Güvenli loglama**: yalnızca model adı, süre (ms), HTTP status, retry
  sayısı, chunk sayısı — API anahtarı ve transkript/yanıt içeriği asla
  loglanmıyor.
- **Uzun transkript chunking**: transkript artık tek istekte gönderilmiyor.
  ~4000 karakterlik parçalara bölünüyor (zaman damgaları korunarak), her
  parça ayrı özetleniyor, parça özetleri birleştirilip tek, hâlâ sınırlı
  boyutlu bir final istekle yapılandırılmış JSON (özet/kararlar/riskler)
  üretiliyor. Yapılacaklar (action items) parça başına çıkarılıp
  tekrarsızlaştırılarak birleştiriliyor.
- Herhangi bir AI hatası → otomatik yerel (extractive) fallback; toplantı
  hiçbir zaman sadece AI hatası yüzünden tamamen başarısız olmuyor.
- 9 yeni test: key yok, başarılı çağrı, timeout-sonra-başarı,
  rate-limit-tükenmiş-fallback, auth-anında-fail, malformed-request-anında-fail,
  bozuk JSON, uzun transkript chunking, action-item chunking/dedupe
  (`test_analysis_resilience.py`). Ayrıca pipeline seviyesinde "AI hatasından
  sonra transkript kaybolmuyor" testi.

### Bölüm 4 — OpenRouter ayarları ve UX

- `/health` artık `openrouter_model` (yalnızca AI etkinse) ve
  `local_fallback_available: true` döndürüyor; API anahtarı asla dönmüyor.
- Header'a küçük bir "Yapay Zeka Ayarları" bilgi diyaloğu eklendi
  (`ai-settings-dialog.tsx`) — normal toplantı akışında API anahtarı hiç
  sorulmuyor, sadece bilgilendirme amaçlı.
- README'de `.env` dosyasının commit edilmemesi gerektiği ve kurulum adımları
  zaten belgeliydi, güncellendi.

### Bölüm 5 — UI/UX cilası

- Upload panelinde sahte maksimum boyut yazısı kaldırıldı, büyük dosya
  uyarısı eklendi.
- 375/768/1024/1440px genişliklerde yatay taşma olmadığı gerçek tarayıcıda
  doğrulandı (`scrollWidth === clientWidth`).
- Kapsamlı bir yeniden tasarım yapılmadı — mevcut hata mesajları, işlem
  aşamaları göstergesi ve `source=fallback` etiketleme zaten iyi
  durumdaydı.

## Sonradan bulunan ve düzeltilen ek hata: sessiz ekran kaydı

İlk turdan sonra kullanıcı gerçek bir kayıtla test etti ve "ekran görüntüsü
aldıktan sonra çevirmede sıkıntı oluyor" bildirdi. Veritabanındaki gerçek
başarısız kayıt (`ceeb862d-...webm`) incelendi:

- `ffprobe` ses akışının var olduğunu gösteriyordu (opus, mono, 48kHz).
- Ama `ffmpeg ... -af volumedetect` ile ölçülen ses seviyesi **-91dB** —
  yani dijital sessizlik.

**Kök neden**: "Sekme sesini paylaş" seçeneği yalnızca paylaşılan sekmenin
kendi çaldığı sesi yakalıyor (örn. bir Meet/Zoom sekmesindeki karşı taraf),
**mikrofonu hiçbir zaman içermiyor**. Kullanıcı kendi sekmesini paylaşıp
mikrofona konuşunca, sekmenin kendisi ses çalmadığı için kayıt tamamen
sessiz kalıyordu — ve uygulama bunu asla uyarmıyordu çünkü sadece "ses
kanalı var mı" (track sayısı) kontrol ediyordu, "gerçekten ses var mı"
değil.

**Düzeltme** (`apps/web/src/lib/media-recorder.ts`,
`apps/web/src/components/recording/record-panel.tsx`):

- Ekran/sekme modunda artık mikrofon da isteniyor (best-effort — reddedilirse
  sekme sesiyle devam ediliyor, akış bozulmuyor).
- `mixAudioTracks()` — tek bir `AudioContext` üzerinden sekme sesi ve
  mikrofonu tek ses parçasında birleştiriyor, bu birleşik parça video
  parçasıyla birlikte `MediaRecorder`'a veriliyor.
- `AudioContext` "suspended" durumda oluşturulursa (bazı tarayıcıların
  autoplay politikası) açıkça `resume()` çağrılıyor — aksi halde aynı
  sessizlik hatası farklı bir yoldan tekrar oluşabilirdi.
- Hiçbir ses kaynağı yoksa (ne sekme ne mikrofon) eski uyarı yine çıkıyor,
  artık her iki olası nedeni de anlatan güncellenmiş Türkçe metinle.
- 8 yeni birim testi (`media-recorder.test.ts`): boş track listesi, tek/çok
  track karıştırma, `AudioContext`/`webkitAudioContext` bulma mantığı.

## Değişen dosyalar (özet)

**Backend**: `config.py`, `services/storage.py`, `services/analysis.py`,
`routers/health.py`, `.env.example`, ilgili testler
(`test_storage.py`, `test_analysis_resilience.py`, `test_health.py`,
`test_pipeline.py`).

**Frontend**: `lib/validation.ts`, `lib/media-recorder.ts`,
`lib/media-errors.ts`, `lib/api.ts`, `lib/types.ts`,
`components/recording/upload-panel.tsx`,
`components/recording/record-panel.tsx`,
`components/ai-settings-dialog.tsx` (yeni), `components/app-header.tsx`,
ilgili test dosyaları.

**Diğer**: `README.md`, `.claude/launch.json` (backend+frontend'i birlikte
başlatan `full-dev` önizleme yapılandırması eklendi).

## Kalite kapısı (hepsi geçti)

Backend: `ruff check` ✓, `ruff format --check` ✓, `pytest` (55/55) ✓
Frontend: `eslint` ✓, `tsc --noEmit` ✓, `vitest` (52/52) ✓, `next build` ✓

## Gerçek doğrulama

`npm run dev` ile backend+frontend birlikte çalıştırılıp gerçek
tarayıcıda test edildi: ana sayfa, AI Ayarları diyaloğu (gerçek `/health`
verisiyle), upload paneli, gerçek bir toplantının detay sayfası (yerel
fallback etiketlemesi doğru görüldü), 4 farklı ekran genişliğinde taşma
kontrolü, konsol hatası kontrolü.

**Dürüst sınır**: `getDisplayMedia`/`getUserMedia`'nın native OS izin
diyalogları bu otomatik ortamda açılamıyor — ekran/sekme paylaşımı ve
mikrofon karıştırmanın gerçek tarayıcıda uçtan uca (gerçek ses sinyaliyle)
doğrulanması kullanıcı tarafında yapılmalı. OpenRouter'ın canlı bir ücretsiz
modelle gerçek isteği de API anahtarı olmadığı için test edilemedi (kod
yolu unit testlerle simüle edildi).

## Commit geçmişi (bu tur)

```
0c5e5b4 fix: mix microphone into screen/tab recordings to fix silent audio
0bd5b33 docs: explain optional OpenRouter configuration
72c0c01 feat: polish recording and processing experience
433fd84 fix: add resilient meeting analysis fallback
ff7e8a6 fix: support unlimited streamed media uploads
```

(Bölüm 2'nin çoğunu çözen önceki tur: `a077af7`, `0efcae8`, `bf40bd2`.)

## Kullanıcı tarafında test adımları

```bash
npm run dev
```

1. `http://localhost:3000` → sağ üstteki dişli ikonu → AI Ayarları
   diyaloğunu doğrula.
2. `/new` → "Dosya Yükle" → 500MB üstü bir dosya seç, büyük-dosya uyarısını
   gör, yükle.
3. `/new` → "Kayıt Yap" → "Ekran/Sekme Sesi" → bir Chrome sekmesi paylaş,
   "Sekme sesini paylaş" işaretle, ardından açılan mikrofon izin isteğini
   de onayla, konuş, kaydı durdur — transkript artık sesini içermeli.
4. Aynı akışı mikrofon iznini reddederek dene — sekme sesi varsa yine
   çalışmalı; hiçbiri yoksa güncellenmiş uyarı mesajını gör.
5. `apps/api/.env`'e gerçek `OPENROUTER_API_KEY` ekleyip bir toplantı işle,
   gerçek AI özetinin geldiğini doğrula.
6. `apps/api/.env`'i boş bırakıp aynı akışı dene — "Yerel Analiz" etiketiyle
   çalışmaya devam etmeli.
