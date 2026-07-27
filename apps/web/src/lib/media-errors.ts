export type RecordingMode = "screen" | "microphone";

export const SCREEN_SHARE_CANCELLED_MESSAGE =
  "Ekran veya sekme paylaşımı iptal edildi. Kayıt başlatılmadı.";

export const MIC_PERMISSION_DENIED_MESSAGE =
  "Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofon erişimine izin verin.";

export const SYSTEM_AUDIO_UNAVAILABLE_MESSAGE =
  'Tarayıcı sistem sesini paylaşamadı. Chrome sekmesi seçip "Sekme sesini paylaş" seçeneğini etkinleştirin veya yalnızca mikrofon kaydını kullanın.';

export const BROWSER_UNSUPPORTED_MESSAGE =
  "Tarayıcınız ekran veya mikrofon kaydını desteklemiyor. Güncel bir Chrome veya Edge tarayıcısı kullanmayı deneyin.";

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

/** Maps a getDisplayMedia/getUserMedia rejection to a Turkish message, distinguishing by error.name. */
export function getMediaStartErrorMessage(err: unknown, mode: RecordingMode): string {
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return mode === "screen" ? SCREEN_SHARE_CANCELLED_MESSAGE : MIC_PERMISSION_DENIED_MESSAGE;
  }
  return GENERIC_START_FAILURE_MESSAGE;
}
