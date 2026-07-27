export const ALLOWED_MEDIA_EXTENSIONS = [".mp3", ".wav", ".m4a", ".mp4", ".webm", ".ogg"];
export const MAX_UPLOAD_MB = 500;

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export function validateMediaFile(
  file: { name: string; size: number },
  maxSizeMb: number = MAX_UPLOAD_MB
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

  if (file.size > maxSizeMb * 1024 * 1024) {
    return {
      ok: false,
      error: `Dosya çok büyük. Maksimum boyut: ${maxSizeMb} MB.`,
    };
  }

  return { ok: true };
}
