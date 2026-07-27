import { describe, expect, it } from "vitest";
import {
  BROWSER_UNSUPPORTED_MESSAGE,
  MEDIARECORDER_START_FAILURE_MESSAGE,
  MEDIARECORDER_UNSUPPORTED_MESSAGE,
  MIC_PERMISSION_DENIED_MESSAGE,
  NO_VIDEO_TRACK_MESSAGE,
  SCREEN_SHARE_CANCELLED_MESSAGE,
  getMediaStartErrorMessage,
  isMediaApiSupported,
} from "./media-errors";
import { NoVideoTrackError, RecorderStartError, RecorderUnsupportedError } from "./media-recorder";

// Never invoked; only its presence/type is checked by isMediaApiSupported.
const fakeMediaMethod = async () => ({}) as MediaStream;

describe("getMediaStartErrorMessage", () => {
  it("reports screen-share cancellation when the user dismisses the picker", () => {
    const err = new DOMException("Permission denied", "NotAllowedError");
    expect(getMediaStartErrorMessage(err, "screen")).toBe(SCREEN_SHARE_CANCELLED_MESSAGE);
  });

  it("reports microphone permission denial separately from screen-share cancellation", () => {
    const err = new DOMException("Permission denied", "NotAllowedError");
    expect(getMediaStartErrorMessage(err, "microphone")).toBe(MIC_PERMISSION_DENIED_MESSAGE);
  });

  it("does not use the unsupported-browser message for a plain runtime error", () => {
    const message = getMediaStartErrorMessage(new Error("device busy"), "microphone");
    expect(message).not.toBe(BROWSER_UNSUPPORTED_MESSAGE);
    expect(message).not.toBe(SCREEN_SHARE_CANCELLED_MESSAGE);
    expect(message).not.toBe(MIC_PERMISSION_DENIED_MESSAGE);
  });

  it("reports a missing video track distinctly from a cancelled picker", () => {
    expect(getMediaStartErrorMessage(new NoVideoTrackError(), "screen")).toBe(NO_VIDEO_TRACK_MESSAGE);
  });

  it("reports MediaRecorder being wholly unsupported", () => {
    expect(getMediaStartErrorMessage(new RecorderUnsupportedError(), "screen")).toBe(
      MEDIARECORDER_UNSUPPORTED_MESSAGE
    );
  });

  it("reports a MediaRecorder construction/start failure distinctly from an unsupported browser", () => {
    const err = new RecorderStartError(new DOMException("mime not supported", "NotSupportedError"));
    expect(getMediaStartErrorMessage(err, "screen")).toBe(MEDIARECORDER_START_FAILURE_MESSAGE);
  });
});

describe("isMediaApiSupported", () => {
  it("reports unsupported when navigator.mediaDevices is missing", () => {
    expect(isMediaApiSupported("screen", undefined)).toBe(false);
  });

  it("reports unsupported when the mode-specific method is missing", () => {
    expect(isMediaApiSupported("screen", { getUserMedia: fakeMediaMethod })).toBe(false);
  });

  it("reports supported when the browser exposes getDisplayMedia (successful screen-capture start)", () => {
    expect(isMediaApiSupported("screen", { getDisplayMedia: fakeMediaMethod })).toBe(true);
  });

  it("reports supported when the browser exposes getUserMedia for microphone mode", () => {
    expect(isMediaApiSupported("microphone", { getUserMedia: fakeMediaMethod })).toBe(true);
  });
});
