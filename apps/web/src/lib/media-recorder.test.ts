import { describe, expect, it } from "vitest";
import {
  collectChunk,
  countTracks,
  createRecorder,
  MIC_MIME_CANDIDATES,
  NoVideoTrackError,
  pickSupportedMimeType,
  RecorderStartError,
  RecorderUnsupportedError,
  SCREEN_MIME_CANDIDATES,
  shouldStopRecorder,
  startRecorder,
} from "./media-recorder";

describe("pickSupportedMimeType", () => {
  it("picks vp9 when the browser supports it", () => {
    const supported = new Set(["video/webm;codecs=vp9,opus"]);
    const type = pickSupportedMimeType(SCREEN_MIME_CANDIDATES, (t) => supported.has(t));
    expect(type).toBe("video/webm;codecs=vp9,opus");
  });

  it("falls back to vp8 when vp9 is unsupported", () => {
    const supported = new Set(["video/webm;codecs=vp8,opus", "video/webm"]);
    const type = pickSupportedMimeType(SCREEN_MIME_CANDIDATES, (t) => supported.has(t));
    expect(type).toBe("video/webm;codecs=vp8,opus");
  });

  it("falls back to plain video/webm when only that is supported", () => {
    const supported = new Set(["video/webm"]);
    const type = pickSupportedMimeType(SCREEN_MIME_CANDIDATES, (t) => supported.has(t));
    expect(type).toBe("video/webm");
  });

  it("returns an empty string (let the browser choose) when nothing on the list is supported", () => {
    const type = pickSupportedMimeType(SCREEN_MIME_CANDIDATES, () => false);
    expect(type).toBe("");
  });

  it("selects an audio candidate for microphone-only recording", () => {
    const supported = new Set(["audio/webm;codecs=opus"]);
    const type = pickSupportedMimeType(MIC_MIME_CANDIDATES, (t) => supported.has(t));
    expect(type).toBe("audio/webm;codecs=opus");
  });
});

describe("countTracks", () => {
  it("reports a display stream with both video and audio", () => {
    const stream = { getVideoTracks: () => [{}], getAudioTracks: () => [{}] };
    expect(countTracks(stream)).toEqual({ video: 1, audio: 1 });
  });

  it("reports a display stream with video but no shared audio", () => {
    const stream = { getVideoTracks: () => [{}], getAudioTracks: () => [] };
    expect(countTracks(stream)).toEqual({ video: 1, audio: 0 });
  });

  it("reports a display stream with no video track", () => {
    const stream = { getVideoTracks: () => [], getAudioTracks: () => [{}] };
    expect(countTracks(stream).video).toBe(0);
  });
});

describe("NoVideoTrackError", () => {
  it("carries a distinguishable name for error-mapping", () => {
    expect(new NoVideoTrackError().name).toBe("NoVideoTrackError");
  });
});

describe("createRecorder", () => {
  it("wraps a MediaRecorder constructor failure in a RecorderStartError", () => {
    class ThrowingMediaRecorder {
      constructor() {
        throw new DOMException("mime not supported", "NotSupportedError");
      }
    }
    // @ts-expect-error - stubbing the global for this test only
    globalThis.MediaRecorder = ThrowingMediaRecorder;

    expect(() => createRecorder({} as MediaStream, "video/webm")).toThrow(RecorderStartError);
  });
});

describe("startRecorder", () => {
  it("wraps a MediaRecorder.start() failure in a RecorderStartError", () => {
    const fakeRecorder = {
      start: () => {
        throw new DOMException("already started", "InvalidStateError");
      },
    } as unknown as MediaRecorder;

    expect(() => startRecorder(fakeRecorder)).toThrow(RecorderStartError);
  });

  it("does not throw when start() succeeds", () => {
    let started = false;
    const fakeRecorder = { start: () => { started = true; } } as unknown as MediaRecorder;
    expect(() => startRecorder(fakeRecorder)).not.toThrow();
    expect(started).toBe(true);
  });
});

describe("shouldStopRecorder", () => {
  it("allows stopping a recording in progress (native Stop sharing path)", () => {
    expect(shouldStopRecorder({ state: "recording" } as MediaRecorder)).toBe(true);
  });

  it("allows stopping a paused recording", () => {
    expect(shouldStopRecorder({ state: "paused" } as MediaRecorder)).toBe(true);
  });

  it("refuses a second stop once the recorder is already inactive", () => {
    expect(shouldStopRecorder({ state: "inactive" } as MediaRecorder)).toBe(false);
  });

  it("refuses when there is no recorder at all", () => {
    expect(shouldStopRecorder(null)).toBe(false);
    expect(shouldStopRecorder(undefined)).toBe(false);
  });
});

describe("collectChunk", () => {
  it("ignores empty dataavailable chunks", () => {
    const chunks: Blob[] = [];
    collectChunk(chunks, { size: 0 } as Blob);
    expect(chunks).toHaveLength(0);
  });

  it("keeps non-empty chunks", () => {
    const chunks: Blob[] = [];
    collectChunk(chunks, { size: 42 } as Blob);
    expect(chunks).toHaveLength(1);
  });
});

describe("RecorderUnsupportedError", () => {
  it("carries a distinguishable name for error-mapping", () => {
    expect(new RecorderUnsupportedError().name).toBe("RecorderUnsupportedError");
  });
});
