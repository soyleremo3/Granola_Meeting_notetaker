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
