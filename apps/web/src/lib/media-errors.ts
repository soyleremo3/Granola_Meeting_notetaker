import { NoVideoTrackError, RecorderStartError, RecorderUnsupportedError } from "./media-recorder";

export type RecordingMode = "screen" | "microphone";

export const SCREEN_SHARE_CANCELLED_MESSAGE =
  "Ekran veya sekme paylaşımı iptal edildi. Kayıt başlatılmadı.";

export const MIC_PERMISSION_DENIED_MESSAGE =
  "Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofon erişimine izin verin.";

export const NO_VIDEO_TRACK_MESSAGE =
  "Paylaşılan kaynaktan görüntü alınamadı. Lütfen bir ekran, pencere veya Chrome sekmesi seçin.";

export const SYSTEM_AUDIO_UNAVAILABLE_MESSAGE =
  "Kayıt başladı ancak ne paylaşılan sekmeden ne de mikrofonunuzdan ses alınabildi. Görüntü kaydı " +
  "yine de tamamlanacak, ancak konuşma metnine (transkript) dönüştürme için ses gereklidir. " +
  "Mikrofon izni verdiğinizden emin olun veya Chrome Sekmesi'ni seçip 'Sekme sesini paylaş' " +
  "seçeneğini etkinleştirin.";

export const BROWSER_UNSUPPORTED_MESSAGE =
  "Tarayıcınız ekran veya mikrofon kaydını desteklemiyor. Güncel bir Chrome veya Edge tarayıcısı kullanmayı deneyin.";

export const MEDIARECORDER_UNSUPPORTED_MESSAGE =
  "Tarayıcınız bu kayıt biçimini desteklemiyor. Güncel Google Chrome ile tekrar deneyin.";

export const MEDIARECORDER_START_FAILURE_MESSAGE =
  "Kayıt motoru başlatılamadı. Tarayıcı konsolundaki hata kaydedildi; lütfen tekrar deneyin.";

export const SHARING_ENDED_MESSAGE = "Ekran paylaşımı sona erdi. Kayıt güvenli şekilde durduruldu.";

const GENERIC_START_FAILURE_MESSAGE = "Kayıt başlatılamadı. Lütfen tekrar deneyin.";

interface MediaDevicesLike {
  getDisplayMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
  getUserMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
}

/** Checks that the browser truly exposes the media API the given recording mode needs. */
export function isMediaApiSupported(
  mode: RecordingMode,
  mediaDevices: MediaDevicesLike | undefined | null
): boolean {
  if (!mediaDevices) return false;
  return mode === "screen"
    ? typeof mediaDevices.getDisplayMedia === "function"
    : typeof mediaDevices.getUserMedia === "function";
}

/**
 * Maps a startRecording failure to a Turkish message, dispatching on the real error name
 * instead of collapsing every failure into one generic string.
 */
export function getMediaStartErrorMessage(err: unknown, mode: RecordingMode): string {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return mode === "screen" ? SCREEN_SHARE_CANCELLED_MESSAGE : MIC_PERMISSION_DENIED_MESSAGE;
  }
  if (err instanceof NoVideoTrackError) return NO_VIDEO_TRACK_MESSAGE;
  if (err instanceof RecorderUnsupportedError) return MEDIARECORDER_UNSUPPORTED_MESSAGE;
  if (err instanceof RecorderStartError) return MEDIARECORDER_START_FAILURE_MESSAGE;
  return GENERIC_START_FAILURE_MESSAGE;
}
