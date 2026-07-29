import { describe, expect, it } from "vitest";
import { AUDIO_MIME_CANDIDATES, pickSupportedMimeType } from "../src/lib/mime";

describe("pickSupportedMimeType", () => {
  it("prefers audio/webm;codecs=opus when supported", () => {
    const supported = new Set(["audio/webm;codecs=opus", "audio/webm"]);
    expect(pickSupportedMimeType(AUDIO_MIME_CANDIDATES, (t) => supported.has(t))).toBe(
      "audio/webm;codecs=opus"
    );
  });

  it("falls back to plain audio/webm when opus codec isn't reported as supported", () => {
    const supported = new Set(["audio/webm"]);
    expect(pickSupportedMimeType(AUDIO_MIME_CANDIDATES, (t) => supported.has(t))).toBe("audio/webm");
  });

  it("falls back to the browser default (empty string) when nothing matches", () => {
    expect(pickSupportedMimeType(AUDIO_MIME_CANDIDATES, () => false)).toBe("");
  });
});
