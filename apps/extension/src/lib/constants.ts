export const MEET_HOST = "meet.google.com";
export const ZOOM_HOST_SUFFIX = ".zoom.us";
export const ZOOM_HOST = "zoom.us";

/** MutationObserver callbacks are coalesced into a single DOM scan after this much quiet time. */
export const DETECTOR_DEBOUNCE_MS = 500;

/** How often the background service worker polls /api/meetings/{id}/status while processing. */
export const STATUS_POLL_INTERVAL_MS = 4000;

/** Safety cutoff so a stuck backend can't poll forever. */
export const STATUS_POLL_TIMEOUT_MS = 30 * 60 * 1000;

export const CONSENT_REMINDER_TEXT =
  "Kayda başlamadan önce tüm katılımcıların iznini aldığınızdan emin olun.";

export const NO_AUDIO_TRACK_MESSAGE =
  "Toplantı sekmesinden ses alınamadı. Sekmenin sesinin açık olduğundan ve toplantının tarayıcı üzerinden çalıştığından emin olun.";

export const ZOOM_DESKTOP_ONLY_MESSAGE =
  "Zoom masaüstü uygulaması bu eklentiyle kaydedilemez. Toplantıyı Zoom Web Client üzerinden açın veya dosya yükleme özelliğini kullanın.";

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Yerel Not Defteri sunucusuna ulaşılamadı. Proje klasöründe 'npm run dev' komutunu çalıştırın.";

// Chrome only grants chrome.tabCapture per-tab permission when the user invokes the extension
// itself (its toolbar icon/popup) — a click on a page-injected banner button doesn't carry that
// grant, so the banner redirects here instead of trying (and silently failing) to start capture.
export const START_FROM_POPUP_MESSAGE =
  "Kaydı başlatmak için tarayıcı araç çubuğundaki Not Defteri simgesine tıklayın.";

export const TAB_CAPTURE_FAILED_MESSAGE =
  "Kayıt başlatılamadı: Chrome bu sekmeyi yakalamaya izin vermedi. Eklenti simgesinden (popup) tekrar deneyin.";

export const OFFSCREEN_CREATE_FAILED_MESSAGE =
  "Kayıt başlatılamadı: kayıt bileşeni oluşturulamadı. Sayfayı yenileyip tekrar deneyin.";

export const RECORDER_START_FAILED_MESSAGE =
  "Kayıt başlatılamadı: tarayıcı ses kaydediciyi başlatamadı. Sayfayı yenileyip tekrar deneyin.";
