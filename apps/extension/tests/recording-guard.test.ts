import { describe, expect, it } from "vitest";
import {
  canStartRecording,
  canStopRecording,
  collectChunk,
  createBlobOnce,
  hasAudioTrack,
  type BlobOnceGuard,
} from "../src/lib/recording-guard";

describe("canStartRecording / canStopRecording (duplicate start/stop prevention)", () => {
  it("allows starting only from idle", () => {
    expect(canStartRecording("idle")).toBe(true);
    expect(canStartRecording("recording")).toBe(false);
    expect(canStartRecording("stopped")).toBe(false);
  });

  it("allows stopping only while recording", () => {
    expect(canStopRecording("recording")).toBe(true);
    expect(canStopRecording("idle")).toBe(false);
    expect(canStopRecording("stopped")).toBe(false);
  });
});

describe("collectChunk (empty chunk handling)", () => {
  it("keeps non-empty chunks", () => {
    const chunks: Blob[] = [];
    collectChunk(chunks, new Blob(["hello"]));
    expect(chunks).toHaveLength(1);
  });

  it("drops empty chunks", () => {
    const chunks: Blob[] = [];
    collectChunk(chunks, new Blob([]));
    expect(chunks).toHaveLength(0);
  });
});

describe("createBlobOnce (final Blob created exactly once)", () => {
  it("builds the blob from the collected chunks on first call", () => {
    const guard: BlobOnceGuard = { created: false };
    const blob = createBlobOnce(guard, [new Blob(["a"]), new Blob(["b"])], "audio/webm");
    expect(blob).not.toBeNull();
    expect(blob?.type).toBe("audio/webm");
    expect(guard.created).toBe(true);
  });

  it("returns null on any subsequent call, even if onstop somehow fires twice", () => {
    const guard: BlobOnceGuard = { created: false };
    createBlobOnce(guard, [new Blob(["a"])], "audio/webm");
    const second = createBlobOnce(guard, [new Blob(["a"])], "audio/webm");
    expect(second).toBeNull();
  });

  it("falls back to audio/webm when no mimeType was negotiated", () => {
    const guard: BlobOnceGuard = { created: false };
    const blob = createBlobOnce(guard, [new Blob(["a"])], "");
    expect(blob?.type).toBe("audio/webm");
  });
});

describe("hasAudioTrack (no-audio handling)", () => {
  it("is false when the captured stream has no audio track", () => {
    expect(hasAudioTrack({ getAudioTracks: () => [] })).toBe(false);
  });

  it("is true when at least one audio track is present", () => {
    expect(hasAudioTrack({ getAudioTracks: () => [{}] })).toBe(true);
  });
});
