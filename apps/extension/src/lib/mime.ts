/** Preferred audio-only recording formats, in priority order (per spec: opus, then plain webm, then browser default). */
export const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm"];

/** Returns the first supported candidate, or "" to let MediaRecorder pick its own default. */
export function pickSupportedMimeType(
  candidates: string[] = AUDIO_MIME_CANDIDATES,
  isTypeSupported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)
): string {
  for (const type of candidates) {
    if (isTypeSupported(type)) return type;
  }
  return "";
}

/** All three candidates are webm containers, so the uploaded file extension is always fixed. */
export const RECORDING_FILE_EXTENSION = ".webm";
