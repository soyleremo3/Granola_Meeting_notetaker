# Not Defteri Chrome Eklentisi

Google Meet ve Zoom Web Client toplantılarını tek tıkla kaydedip, mevcut Not Defteri
backend/frontend'ine (bkz. kök [README.md](../../README.md)) yükleyen Manifest V3 Chrome
eklentisi. Eklenti, projenin var olan yükleme ve manuel kayıt özelliklerinin **yerine geçmez** —
onlara ek bir üçüncü giriş noktasıdır.

## Mimariye Kısa Bakış

- **content scripts** (`meet-content.ts`, `zoom-content.ts`): sayfayı MutationObserver + debounce
  ile izler, toplantıya katılındığını/ayrılındığını algılar, sayfa içi Türkçe bildirim şeridini
  gösterir.
- **background service worker** (`service-worker.ts`): tüm durumu yönetir (`chrome.storage.session`
  üzerinde tutulur, çünkü MV3 service worker'ı istediği an durup yeniden başlayabilir), kayıt
  başlatma/durdurma komutlarını verir, sekme kapanma/yön değiştirme olaylarını dinler, sonuç
  sayfasını açar.
- **offscreen document** (`offscreen.ts`): `chrome.tabCapture` akışını, `MediaRecorder`'ı, ses
  parçalarını ve son `Blob`'u elinde tutar; yükleme/işleme akışını (create → upload → process →
  poll) doğrudan burada çalıştırır çünkü ses verisi `chrome.runtime.sendMessage` ile taşınamayacak
  kadar büyük olabilir (mesajlaşma yalnızca JSON'u destekler).
- **popup** / **options**: durum gösterimi ve ayarlar.

## Kurulum ve Derleme

```bash
npm install --prefix apps/extension
npm run extension:build
```

Bu, `apps/extension/dist/` klasörünü oluşturur — Chrome'a yüklenecek olan budur.
Geliştirme sırasında otomatik yeniden derleme için:

```bash
npm run extension:dev
```

## chrome://extensions Kurulumu (Load Unpacked)

1. Chrome'da `chrome://extensions` adresine gidin.
2. Sağ üstten **Geliştirici modu**'nu açın.
3. **Paketlenmemiş öğe yükle** butonuna tıklayın.
4. `apps/extension/dist` klasörünü seçin.
5. Eklenti simgesini araç çubuğuna sabitleyin (isteğe bağlı ama pratik).
6. Ayarlar sayfasından (eklenti simgesine sağ tık → Seçenekler, ya da popup'taki dişli simgesi)
   backend/frontend adreslerini kontrol edin. Varsayılanlar `http://localhost:8000` ve
   `http://localhost:3000`'dir — proje kök dizininde `npm run dev` çalışıyorsa değiştirmenize
   gerek yoktur.

> Kod her değiştiğinde `npm run extension:build` (veya `extension:dev` açıksa otomatik) çalıştırıp
> `chrome://extensions` sayfasından eklentinin yenile (⟳) simgesine basmanız gerekir.

## Google Meet Test Adımları

1. Proje kökünde `npm run dev` ile backend+frontend'i başlatın.
2. `https://meet.google.com/xxx-xxxx-xxx` biçiminde bir toplantıya katılın.
3. Toplantıya gerçekten katıldığınızda (lobide değil, kontrol çubuğu göründüğünde) ekranın altında
   **"Toplantı algılandı"** şeridi çıkar.
4. **Kaydı Başlat**'a tıklayın. Chrome'un normal ekran/sekme paylaşım penceresi **açılmaz** —
   kayıt doğrudan sekme sesinden başlar.
5. Popup'ı açıp (eklenti simgesi) sayacın ilerlediğini doğrulayın.
6. Başka bir sekmeye geçin; kaydın durmadığını, şeridin/timer'ın arka planda devam ettiğini
   popup'tan kontrol edin.
7. Toplantıdan ayrılın (veya sekmeyi kapatın): kayıt otomatik durur, "Yükleniyor" → "Toplantı
   analiz ediliyor" aşamaları popup'ta görünür, işlem bitince toplantı sayfası otomatik açılır.

## Zoom Web Client Test Adımları

1. Bir Zoom toplantı linkini açın ve **tarayıcıdan katıl** seçeneğini kullanarak Zoom Web
   Client'a girin (masaüstü uygulamasını açmayın).
2. Toplantıya katıldığınızda şerit görünür; akış Meet ile birebir aynıdır.
3. Eğer link sizi doğrudan "Zoom açılıyor / masaüstü uygulamasını aç" ekranında bırakıyorsa,
   eklenti şu uyarıyı gösterir ve kayıt başlatmaz:
   > "Zoom masaüstü uygulaması bu eklentiyle kaydedilemez. Toplantıyı Zoom Web Client üzerinden
   > açın veya dosya yükleme özelliğini kullanın."
4. Toplantı bittiğinde ("This meeting has been ended by host" ekranı) kayıt otomatik durur.

## Ayarlar

| Ayar | Açıklama |
| --- | --- |
| Backend adresi | Varsayılan `http://localhost:8000` |
| Frontend adresi | Varsayılan `http://localhost:3000` |
| Google Meet algılamayı etkinleştir | Kapatılırsa Meet sekmelerinde eklenti hiçbir şey yapmaz |
| Zoom Web algılamayı etkinleştir | Kapatılırsa Zoom sekmelerinde eklenti hiçbir şey yapmaz |
| Sayfa içi bildirim şeridini göster | Kapatılırsa şerit gösterilmez; kayıt yine de popup'tan başlatılabilir |
| Toplantı bitince kaydı otomatik durdur | Kapatılırsa yalnızca "Kaydı Durdur" ile durur |
| İşlem bitince toplantı sayfasını otomatik aç | Kapatılırsa popup'ta "Sonucu Aç" butonuna basmanız gerekir |

## Bilinen Sınırlamalar

- **Chrome, sekme sesi yakalamayı yalnızca gerçek bir kullanıcı hareketi sonrasında izin verir.**
  Bu eklenti sessiz/tam otomatik kayıt yapamaz ve yapmaya çalışmaz — "Kaydı Başlat" tıklaması
  şarttır.
- Sayfa içi şeritteki "Kaydı Başlat" düğmesi bir içerik betiği (content script) düğmesidir;
  arka plana mesajla iletilip oradan `chrome.tabCapture` çağrılır. Bu, resmi Chrome örneklerinde
  doğrudan gösterilen "action tıklaması → tabCapture" akışından bir adım dolaylıdır. Bu depo
  **gerçek bir Meet/Zoom toplantısında uçtan uca test edilememiştir** (bu ortamda gerçek bir Google
  hesabı/Zoom toplantısına katılıp mikrofon/hoparlör içeren bir tarayıcı oturumu açmak mümkün
  değildir). Popup'taki "Kaydı Başlat" düğmesi, resmi Google örneğindeki akışla birebir aynı
  şekilde çalışır ve tercih edilen yol budur; şerit düğmesi aynı komutu tetikler ama sizin
  ortamınızda ilk denemede çalışmazsa **popup'tan başlatmayı deneyin** ve lütfen bir issue açın.
- Aynı anda birden fazla Meet/Zoom sekmesi açıksa, yalnızca "Kaydı Başlat"a bastığınız sekme
  izlenir; bir kayıt sürerken başka bir sekmedeki toplantı algılansa bile yok sayılır.
- Zoom algılaması metin/aria-label eşleşmesine dayanır; Zoom arayüzünü büyük ölçüde
  güncellerse (örn. yeni bir dil paketi, yeni buton etiketleri) tekrar ayarlanması gerekebilir.
- "Tekrar Yükle" her zaman kaydı **yeniden yükler** (adım bazlı kaldığı yerden değil) — basit ve
  her koşulda güvenli olsun diye böyle tasarlandı.
- Yalnızca `meet.google.com` ve `*.zoom.us` sekmelerinde çalışır; başka bir video konferans aracı
  desteklenmez.

## Gizlilik

- Eklenti yalnızca `meet.google.com`, `*.zoom.us`, `localhost:3000` ve `localhost:8000` adreslerine
  erişebilir (`<all_urls>` istenmez).
- Mikrofon izni **hiç istenmez**; yalnızca sekme sesi yakalanır.
- Ses, kayıt bittiğinde tarayıcı belleğinde (offscreen document) tutulur, backend'e başarıyla
  yüklendikten hemen sonra bellekten silinir ve offscreen belge kapatılır. Eklenti ses/dökümü
  diske yazmaz veya loglamaz.
- Analitik, telemetri veya uzaktan kod yükleme yoktur.
- Ayarlar (`chrome.storage.sync`) yalnızca adresler ve açık/kapalı anahtarlardır; kayıt/döküm
  içeriği asla ayarlara veya `chrome.storage`'a yazılmaz.

## Sorun Giderme

| Belirti | Olası neden / çözüm |
| --- | --- |
| Şerit hiç çıkmıyor | Ayarlardan ilgili platform algılamasının açık olduğundan emin olun; sayfayı yenileyin. |
| "Toplantı sekmesinden ses alınamadı" | Sekmenin sesi kısılı/kapalı olabilir; toplantının tarayıcı üzerinden (uygulama değil) çalıştığından emin olun. |
| "Yerel Not Defteri sunucusuna ulaşılamadı" | Proje kök dizininde `npm run dev` çalıştırın; ayarlardaki backend adresinin doğru olduğunu kontrol edin. |
| Kayıt durdu ama yükleme başarısız oldu | Popup'ta "Tekrar Yükle" ile tekrar deneyin veya "Yerel WebM İndir" ile kaydı bilgisayarınıza indirip elle yükleyin (mevcut dosya yükleme özelliğiyle). |
| Zoom'da masaüstü uygulaması açılıyor | Toplantı linkini "tarayıcıdan katıl" seçeneğiyle açın; aksi halde bu eklenti kayıt yapamaz. |
| Kod değişti ama davranış aynı | `npm run extension:build` çalıştırıp `chrome://extensions` sayfasından eklentiyi yenileyin. |
