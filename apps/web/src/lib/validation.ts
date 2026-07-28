export const ALLOWED_MEDIA_EXTENSIONS = [".mp3", ".wav", ".m4a", ".mp4", ".webm", ".ogg"];
// 0 = no application-level size limit (matches the backend's MAX_UPLOAD_SIZE_MB=0 default).
export const DEFAULT_MAX_UPLOAD_MB = 0;

export const LARGE_FILE_NOTICE =
  "Büyük dosyaların yüklenmesi ve yerel olarak işlenmesi uzun sürebilir. Yeterli disk alanınız olduğundan emin olun.";

// Files above this size trigger the "may take a while" notice, independent of any hard limit.
export const LARGE_FILE_THRESHOLD_MB = 500;

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export function validateMediaFile(
  file: { name: string; size: number },
  maxSizeMb: number = DEFAULT_MAX_UPLOAD_MB
): FileValidationResult {
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();

  if (!ALLOWED_MEDIA_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      error: `Desteklenmeyen dosya türü: ${ext}. Desteklenen türler: ${ALLOWED_MEDIA_EXTENSIONS.join(", ")}`,
    };
  }

  if (file.size === 0) {
    return { ok: false, error: "Seçilen dosya boş görünüyor." };
  }

  if (maxSizeMb > 0 && file.size > maxSizeMb * 1024 * 1024) {
    return {
      ok: false,
      error: `Dosya çok büyük. Maksimum boyut: ${maxSizeMb} MB.`,
    };
  }

  return { ok: true };
}
