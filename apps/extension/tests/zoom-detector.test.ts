import { describe, expect, it } from "vitest";
import {
  classifyZoomState,
  isZoomDesktopOnlyPrompt,
  isZoomMeetingUrl,
  isZoomWebClientUrl,
} from "../src/content/detectors/zoom";
import type { PageSnapshot } from "../src/content/detectors/types";

function snapshot(overrides: Partial<PageSnapshot>): PageSnapshot {
  return { url: "https://zoom.us/wc/123456789/join", ariaLabels: [], bodyText: "", ...overrides };
}

describe("isZoomMeetingUrl / isZoomWebClientUrl", () => {
  it("accepts the web client join URL", () => {
    expect(isZoomMeetingUrl("https://zoom.us/wc/123456789/join")).toBe(true);
    expect(isZoomWebClientUrl("https://zoom.us/wc/123456789/join")).toBe(true);
  });

  it("accepts a regional subdomain launcher URL as a meeting URL but not a web-client URL", () => {
    expect(isZoomMeetingUrl("https://us05web.zoom.us/j/123456789")).toBe(true);
    expect(isZoomWebClientUrl("https://us05web.zoom.us/j/123456789")).toBe(false);
  });

  it("rejects unrelated URLs", () => {
    expect(isZoomMeetingUrl("https://example.com/wc/123/join")).toBe(false);
    expect(isZoomMeetingUrl("https://zoom.us/pricing")).toBe(false);
    expect(isZoomMeetingUrl("not-a-url")).toBe(false);
  });
});

describe("classifyZoomState", () => {
  it("is idle before controls appear", () => {
    expect(classifyZoomState(snapshot({ ariaLabels: [] }))).toBe("idle");
  });

  it("is joined once mute/video/leave controls are present", () => {
    const state = classifyZoomState(
      snapshot({ ariaLabels: ["Leave Meeting", "mute my microphone", "start video"] })
    );
    expect(state).toBe("joined");
  });

  it("recognizes Turkish aria-labels", () => {
    const state = classifyZoomState(
      snapshot({ ariaLabels: ["Toplantıdan ayrıl", "sesimi kapat", "videoyu başlat"] })
    );
    expect(state).toBe("joined");
  });

  it("is ended once the post-meeting marker text appears and leave is gone", () => {
    const state = classifyZoomState(snapshot({ ariaLabels: [], bodyText: "This meeting has been ended by host" }));
    expect(state).toBe("ended");
  });

  it("is idle for unrelated URLs with no ended marker", () => {
    expect(classifyZoomState(snapshot({ url: "https://example.com" }))).toBe("idle");
  });
});

describe("isZoomDesktopOnlyPrompt", () => {
  it("is true on the launcher page prompting to open the desktop app", () => {
    const snap = snapshot({
      url: "https://zoom.us/j/123456789",
      ariaLabels: [],
      bodyText: "Launching Zoom... open Zoom Meetings?",
    });
    expect(isZoomDesktopOnlyPrompt(snap)).toBe(true);
  });

  it("is false once actually inside the web client", () => {
    const snap = snapshot({
      url: "https://zoom.us/wc/123456789/join",
      ariaLabels: ["Leave Meeting", "mute my microphone"],
      bodyText: "",
    });
    expect(isZoomDesktopOnlyPrompt(snap)).toBe(false);
  });

  it("is false for unrelated URLs", () => {
    expect(isZoomDesktopOnlyPrompt(snapshot({ url: "https://example.com", bodyText: "open Zoom Meetings" }))).toBe(
      false
    );
  });
});
