import type { RecordingMode } from "./media-errors";

export const SCREEN_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export const MIC_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

export function mimeCandidatesForMode(mode: RecordingMode): string[] {
  return mode === "screen" ? SCREEN_MIME_CANDIDATES : MIC_MIME_CANDIDATES;
}

/** Returns the first candidate the browser reports as supported, or "" to let the browser pick its own default. */
export function pickSupportedMimeType(
  candidates: string[],
  isTypeSupported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)
): string {
  for (const type of candidates) {
    if (isTypeSupported(type)) return type;
  }
  return "";
}

export interface TrackCountable {
  getVideoTracks(): unknown[];
  getAudioTracks(): unknown[];
}

export function countTracks(stream: TrackCountable): { video: number; audio: number } {
  return { video: stream.getVideoTracks().length, audio: stream.getAudioTracks().length };
}

export class NoVideoTrackError extends Error {
  constructor() {
    super("Display stream has no video track");
    this.name = "NoVideoTrackError";
  }
}

export class RecorderUnsupportedError extends Error {
  constructor() {
    super("MediaRecorder is not available in this browser");
    this.name = "RecorderUnsupportedError";
  }
}

export class RecorderStartError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "RecorderStartError";
    if (cause instanceof Error) this.cause = cause;
  }
}

/** Wraps the MediaRecorder constructor so any native throw (e.g. unsupported mimeType/container) surfaces as a typed RecorderStartError. */
export function createRecorder(stream: MediaStream, mimeType: string): MediaRecorder {
  try {
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (err) {
    throw new RecorderStartError(err);
  }
}

/** Wraps MediaRecorder.start so a native throw (e.g. invalid state) surfaces as a typed RecorderStartError. */
export function startRecorder(recorder: MediaRecorder, timesliceMs = 1000): void {
  try {
    recorder.start(timesliceMs);
  } catch (err) {
    throw new RecorderStartError(err);
  }
}

/**
 * True when the recorder is actually running and stop() is safe to call. Guards both the
 * native "Stop sharing" path and the app's own Stop button against calling stop() twice
 * (a second call on an already-inactive MediaRecorder throws InvalidStateError).
 */
export function shouldStopRecorder(recorder: Pick<MediaRecorder, "state"> | null | undefined): boolean {
  return !!recorder && recorder.state !== "inactive";
}

/** Only non-empty chunks are kept; MediaRecorder can emit empty dataavailable events. */
export function collectChunk(chunks: Blob[], data: Blob): void {
  if (data.size > 0) chunks.push(data);
}
