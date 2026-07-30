import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeChrome, type FakeChrome } from "./fakes/fake-chrome";

let fake: FakeChrome;

async function loadServiceWorker(): Promise<void> {
  fake = createFakeChrome();
  vi.stubGlobal("chrome", fake.chrome);
  vi.resetModules();
  await import("../src/background/service-worker");
}

beforeEach(async () => {
  await loadServiceWorker();
});

function offscreenStartMessages() {
  return fake.sentMessages.filter(
    (m): m is { type: "OFFSCREEN_START_RECORDING" } =>
      typeof m === "object" && m !== null && (m as { type?: string }).type === "OFFSCREEN_START_RECORDING"
  );
}

function offscreenStopMessages() {
  return fake.sentMessages.filter(
    (m): m is { type: "OFFSCREEN_STOP_RECORDING" } =>
      typeof m === "object" && m !== null && (m as { type?: string }).type === "OFFSCREEN_STOP_RECORDING"
  );
}

async function detectAndStartRecording(tabId: number): Promise<void> {
  await fake.emitMessage({ type: "MEETING_DETECTED", platform: "meet" }, { tab: { id: tabId } as chrome.tabs.Tab });
  await fake.emitMessage({ type: "START_RECORDING_REQUESTED" }, { tab: { id: tabId } as chrome.tabs.Tab });
  // The offscreen document confirming playback has actually started is what moves phase -> "recording".
  await fake.emitMessage({ type: "OFFSCREEN_RECORDING_STARTED" });
}

describe("START_RECORDING_REQUESTED (duplicate start prevention)", () => {
  it("only asks the offscreen document to start once for two rapid clicks", async () => {
    await fake.emitMessage({ type: "MEETING_DETECTED", platform: "meet" }, { tab: { id: 1 } as chrome.tabs.Tab });

    const start = () => fake.emitMessage({ type: "START_RECORDING_REQUESTED" }, { tab: { id: 1 } as chrome.tabs.Tab });
    await Promise.all([start(), start()]);

    expect(offscreenStartMessages()).toHaveLength(1);
  });

  it("does not start again once already recording", async () => {
    await detectAndStartRecording(1);
    expect(offscreenStartMessages()).toHaveLength(1);

    await fake.emitMessage({ type: "START_RECORDING_REQUESTED" }, { tab: { id: 1 } as chrome.tabs.Tab });
    expect(offscreenStartMessages()).toHaveLength(1); // still just the one from before
  });
});

describe("STOP_RECORDING_REQUESTED (duplicate stop prevention)", () => {
  it("only asks the offscreen document to stop once even if Stop is clicked twice", async () => {
    await detectAndStartRecording(1);

    await fake.emitMessage({ type: "STOP_RECORDING_REQUESTED" });
    await fake.emitMessage({ type: "STOP_RECORDING_REQUESTED" });

    expect(offscreenStopMessages()).toHaveLength(1);
  });
});

describe("tab lifecycle (automatic stop conditions)", () => {
  it("stops recording when the tracked tab is closed", async () => {
    await detectAndStartRecording(1);

    fake.emitTabRemoved(1);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(offscreenStopMessages()).toHaveLength(1);
  });

  it("does not react to a different tab closing", async () => {
    await detectAndStartRecording(1);

    fake.emitTabRemoved(999);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(offscreenStopMessages()).toHaveLength(0);
  });

  it("stops recording when the tracked tab navigates away from meet.google.com", async () => {
    await detectAndStartRecording(1);

    fake.emitTabUpdated(1, { url: "https://example.com/" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(offscreenStopMessages()).toHaveLength(1);
  });

  it("does not stop when the tab merely navigates within meet.google.com", async () => {
    await detectAndStartRecording(1);

    fake.emitTabUpdated(1, { url: "https://meet.google.com/abc-defg-hij" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(offscreenStopMessages()).toHaveLength(0);
  });
});

describe("GET_STATE_REQUESTED", () => {
  it("reports the current phase back to the popup", async () => {
    await detectAndStartRecording(1);
    const state = (await fake.emitMessage({ type: "GET_STATE_REQUESTED" })) as { phase: string };
    expect(state.phase).toBe("recording");
  });
});

function stateUpdatedMessages() {
  return fake.sentMessages.filter(
    (m): m is { type: "STATE_UPDATED"; state: { phase: string; errorMessage: string | null } } =>
      typeof m === "object" && m !== null && (m as { type?: string }).type === "STATE_UPDATED"
  );
}

describe("popup start success", () => {
  it("starts recording using the tabId the popup queried explicitly, with no sender.tab", async () => {
    await fake.emitMessage({ type: "MEETING_DETECTED", platform: "meet" }, { tab: { id: 1 } as chrome.tabs.Tab });

    // The popup message carries no sender.tab (a popup isn't itself a tab) — only message.tabId.
    await fake.emitMessage({ type: "START_RECORDING_REQUESTED", tabId: 1 }, {});

    expect(offscreenStartMessages()).toHaveLength(1);
  });
});

describe("chrome.tabCapture failure", () => {
  it("surfaces a Turkish error and returns to idle instead of failing silently", async () => {
    fake.behavior.tabCaptureShouldFail = true;
    await fake.emitMessage({ type: "MEETING_DETECTED", platform: "meet" }, { tab: { id: 1 } as chrome.tabs.Tab });

    await fake.emitMessage({ type: "START_RECORDING_REQUESTED" }, { tab: { id: 1 } as chrome.tabs.Tab });

    expect(offscreenStartMessages()).toHaveLength(0);
    const state = (await fake.emitMessage({ type: "GET_STATE_REQUESTED" })) as {
      phase: string;
      errorMessage: string | null;
    };
    expect(state.phase).toBe("idle");
    expect(state.errorMessage).toMatch(/Chrome bu sekmeyi yakalamaya izin vermedi/);
    // The error must reach both the popup (broadcast) and the banner (tab-targeted message).
    const broadcasts = stateUpdatedMessages();
    expect(broadcasts.some((m) => m.state.errorMessage === state.errorMessage)).toBe(true);
    expect(fake.tabsSent.some((s) => s.tabId === 1)).toBe(true);
  });
});

describe("offscreen document creation failure", () => {
  it("surfaces a Turkish error when chrome.offscreen.createDocument rejects", async () => {
    fake.behavior.offscreenCreateShouldFail = true;
    await fake.emitMessage({ type: "MEETING_DETECTED", platform: "meet" }, { tab: { id: 1 } as chrome.tabs.Tab });

    await fake.emitMessage({ type: "START_RECORDING_REQUESTED" }, { tab: { id: 1 } as chrome.tabs.Tab });

    expect(offscreenStartMessages()).toHaveLength(0);
    const state = (await fake.emitMessage({ type: "GET_STATE_REQUESTED" })) as {
      phase: string;
      errorMessage: string | null;
    };
    expect(state.phase).toBe("idle");
    expect(state.errorMessage).toMatch(/kayıt bileşeni oluşturulamadı/);
  });
});

describe("no-audio failure propagation", () => {
  it("returns to idle with the no-audio Turkish message when offscreen reports OFFSCREEN_NO_AUDIO", async () => {
    await fake.emitMessage({ type: "MEETING_DETECTED", platform: "meet" }, { tab: { id: 1 } as chrome.tabs.Tab });
    await fake.emitMessage({ type: "START_RECORDING_REQUESTED" }, { tab: { id: 1 } as chrome.tabs.Tab });

    await fake.emitMessage({ type: "OFFSCREEN_NO_AUDIO" });

    const state = (await fake.emitMessage({ type: "GET_STATE_REQUESTED" })) as {
      phase: string;
      errorMessage: string | null;
    };
    expect(state.phase).toBe("idle");
    expect(state.errorMessage).toMatch(/Toplantı sekmesinden ses alınamadı/);
  });
});

describe("MediaRecorder failure propagation", () => {
  it("returns to idle with a Turkish error when offscreen reports OFFSCREEN_RECORDER_FAILED", async () => {
    await fake.emitMessage({ type: "MEETING_DETECTED", platform: "meet" }, { tab: { id: 1 } as chrome.tabs.Tab });
    await fake.emitMessage({ type: "START_RECORDING_REQUESTED" }, { tab: { id: 1 } as chrome.tabs.Tab });

    await fake.emitMessage({ type: "OFFSCREEN_RECORDER_FAILED" });

    const state = (await fake.emitMessage({ type: "GET_STATE_REQUESTED" })) as {
      phase: string;
      errorMessage: string | null;
    };
    expect(state.phase).toBe("idle");
    expect(state.errorMessage).toMatch(/tarayıcı ses kaydediciyi başlatamadı/);
  });
});

describe("recording state propagation", () => {
  it("broadcasts phase: recording to both the popup channel and the meeting tab once offscreen confirms", async () => {
    await detectAndStartRecording(1);

    const broadcasts = stateUpdatedMessages();
    expect(broadcasts.some((m) => m.state.phase === "recording")).toBe(true);
    expect(
      fake.tabsSent.some(
        (s) =>
          s.tabId === 1 &&
          typeof s.message === "object" &&
          s.message !== null &&
          (s.message as { type?: string }).type === "STATE_UPDATED" &&
          (s.message as { state?: { phase?: string } }).state?.phase === "recording"
      )
    ).toBe(true);
  });
});
