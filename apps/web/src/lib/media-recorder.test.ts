import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectChunk,
  countTracks,
  createRecorder,
  getAudioContextConstructor,
  MIC_MIME_CANDIDATES,
  mixAudioTracks,
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

describe("mixAudioTracks", () => {
  class FakeMediaStream {
    private tracks: unknown[];
    constructor(tracks: unknown[] = []) {
      this.tracks = tracks;
    }
    getAudioTracks() {
      return this.tracks;
    }
  }

  beforeEach(() => {
    // @ts-expect-error - stubbing the global for these tests only; jsdom has no MediaStream
    globalThis.MediaStream = FakeMediaStream;
  });

  afterEach(() => {
    // @ts-expect-error - cleanup the stub
    delete globalThis.MediaStream;
  });

  function fakeTrack(id: string): MediaStreamTrack {
    return { id } as unknown as MediaStreamTrack;
  }

  function fakeAudioContext() {
    const connections: unknown[] = [];
    const destinationTrack = fakeTrack("mixed-output");
    return {
      connections,
      createMediaStreamSource: (stream: MediaStream) => ({
        connect: (destination: unknown) => connections.push({ stream, destination }),
      }),
      createMediaStreamDestination: () => ({
        stream: new FakeMediaStream([destinationTrack]) as unknown as MediaStream,
      }),
    };
  }

  it("returns null when given no tracks to mix (nothing to capture)", () => {
    expect(mixAudioTracks(fakeAudioContext(), [])).toBeNull();
  });

  it("connects every given track into the mix and returns the combined output track", () => {
    const ctx = fakeAudioContext();
    const tabAudio = fakeTrack("tab-audio");
    const micAudio = fakeTrack("mic-audio");

    const result = mixAudioTracks(ctx, [tabAudio, micAudio]);

    expect(result).not.toBeNull();
    expect(ctx.connections).toHaveLength(2); // both tracks routed into the destination
  });

  it("mixes a single track too (e.g. tab audio only, no mic)", () => {
    const ctx = fakeAudioContext();
    const result = mixAudioTracks(ctx, [fakeTrack("tab-audio")]);
    expect(result).not.toBeNull();
    expect(ctx.connections).toHaveLength(1);
  });
});

describe("getAudioContextConstructor", () => {
  afterEach(() => {
    // @ts-expect-error - cleanup stubs between tests
    delete globalThis.AudioContext;
    // @ts-expect-error - cleanup stubs between tests
    delete globalThis.webkitAudioContext;
  });

  it("returns undefined when the browser exposes no AudioContext at all", () => {
    expect(getAudioContextConstructor()).toBeUndefined();
  });

  it("returns the standard AudioContext constructor when present", () => {
    class FakeAudioContext {}
    // @ts-expect-error - stubbing for this test only
    globalThis.AudioContext = FakeAudioContext;
    expect(getAudioContextConstructor()).toBe(FakeAudioContext);
  });

  it("falls back to webkitAudioContext when the standard constructor is absent (older Safari)", () => {
    class FakeWebkitAudioContext {}
    // @ts-expect-error - stubbing for this test only
    globalThis.webkitAudioContext = FakeWebkitAudioContext;
    expect(getAudioContextConstructor()).toBe(FakeWebkitAudioContext);
  });
});
