import { describe, expect, it } from "vitest";
import { classifyMeetState, isMeetUrl } from "../src/content/detectors/meet";
import type { PageSnapshot } from "../src/content/detectors/types";

function snapshot(overrides: Partial<PageSnapshot>): PageSnapshot {
  return { url: "https://meet.google.com/abc-defg-hij", ariaLabels: [], bodyText: "", ...overrides };
}

describe("isMeetUrl", () => {
  it("accepts a real meeting code URL", () => {
    expect(isMeetUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
  });

  it("rejects the Meet landing page", () => {
    expect(isMeetUrl("https://meet.google.com/landing")).toBe(false);
  });

  it("rejects the Meet root URL", () => {
    expect(isMeetUrl("https://meet.google.com/")).toBe(false);
  });

  it("rejects unrelated URLs", () => {
    expect(isMeetUrl("https://example.com/abc-defg-hij")).toBe(false);
    expect(isMeetUrl("https://zoom.us/j/123456")).toBe(false);
    expect(isMeetUrl("not-a-url")).toBe(false);
  });
});

describe("classifyMeetState", () => {
  it("is idle on the pre-join lobby (join button present, no leave/mic/camera controls)", () => {
    const state = classifyMeetState(
      snapshot({ ariaLabels: ["Şimdi katıl", "Kamerayı kapat"], bodyText: "" })
    );
    expect(state).toBe("idle");
  });

  it("is joined once leave/mic/camera controls are present and there is no join button", () => {
    const state = classifyMeetState(
      snapshot({ ariaLabels: ["Aramadan ayrıl", "Mikrofonu kapat", "Kamerayı kapat"] })
    );
    expect(state).toBe("joined");
  });

  it("recognizes English aria-labels too (Meet UI language follows the Google account)", () => {
    const state = classifyMeetState(snapshot({ ariaLabels: ["Leave call", "Turn off microphone"] }));
    expect(state).toBe("joined");
  });

  it("is ended once the post-call marker text appears and the leave button is gone", () => {
    const state = classifyMeetState(
      snapshot({ ariaLabels: [], bodyText: "Aramadan ayrıldınız. Yeniden katıl" })
    );
    expect(state).toBe("ended");
  });

  it("does not flip to ended just because the leave button is still visible alongside stray text", () => {
    const state = classifyMeetState(
      snapshot({
        ariaLabels: ["Aramadan ayrıl", "Mikrofonu kapat", "Kamerayı kapat"],
        bodyText: "call ended", // e.g. a chat message mentioning it — leave button still present
      })
    );
    expect(state).toBe("joined");
  });

  it("is idle for unrelated URLs with no ended marker", () => {
    expect(classifyMeetState(snapshot({ url: "https://example.com" }))).toBe("idle");
  });
});
