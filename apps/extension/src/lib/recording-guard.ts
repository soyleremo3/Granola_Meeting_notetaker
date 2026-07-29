/**
 * Pure state-transition guards for the offscreen recorder, kept separate from the real
 * MediaRecorder/DOM wiring so duplicate-start/duplicate-stop/empty-chunk/blob-once behaviour is
 * unit-testable without a browser.
 */
export type RecordingPhase = "idle" | "recording" | "stopped";

export function canStartRecording(phase: RecordingPhase): boolean {
  return phase === "idle";
}

export function canStopRecording(phase: RecordingPhase): boolean {
  return phase === "recording";
}

/** MediaRecorder can emit empty dataavailable events; only non-empty chunks are kept. */
export function collectChunk(chunks: Blob[], data: Blob): void {
  if (data.size > 0) chunks.push(data);
}

export interface TrackCountable {
  getAudioTracks(): unknown[];
}

/** False when the captured tab stream has no audio track at all (e.g. a muted/silent tab). */
export function hasAudioTrack(stream: TrackCountable): boolean {
  return stream.getAudioTracks().length > 0;
}

export interface BlobOnceGuard {
  created: boolean;
}

/** Ensures the final Blob is built exactly once even if onstop somehow fires more than once. */
export function createBlobOnce(guard: BlobOnceGuard, chunks: Blob[], mimeType: string): Blob | null {
  if (guard.created) return null;
  guard.created = true;
  return new Blob(chunks, { type: mimeType || "audio/webm" });
}
