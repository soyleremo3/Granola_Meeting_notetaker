// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeChrome, type FakeChrome } from "./fakes/fake-chrome";
import { startContentRuntime } from "../src/content/content-runtime";
import { START_FROM_POPUP_MESSAGE } from "../src/lib/constants";
import type { StateSnapshot } from "../src/lib/messages";

let fake: FakeChrome;

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function baseState(overrides: Partial<StateSnapshot> = {}): StateSnapshot {
  return {
    platform: "meet",
    tabId: 1,
    phase: "idle",
    recordingStartedAt: null,
    meetingId: null,
    errorMessage: null,
    stageLabel: null,
    ...overrides,
  };
}

beforeEach(() => {
  document.documentElement.innerHTML = "";
  fake = createFakeChrome();
  vi.stubGlobal("chrome", fake.chrome);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.innerHTML = "";
});

describe("banner click fallback behaviour", () => {
  it("shows the start-from-popup redirect instead of asking background to start capture", async () => {
    startContentRuntime({ platform: "meet", classify: () => "joined", settingsEnabledKey: "meetDetectionEnabled" });
    await flush();

    const startBtn = document.querySelector<HTMLButtonElement>('[data-action="start"]');
    expect(startBtn).not.toBeNull();

    startBtn?.click();

    const sentStartMessages = fake.sentMessages.filter(
      (m) => typeof m === "object" && m !== null && (m as { type?: string }).type === "START_RECORDING_REQUESTED"
    );
    expect(sentStartMessages).toHaveLength(0);
    expect(document.getElementById("not-defteri-banner")?.textContent).toContain(START_FROM_POPUP_MESSAGE);
  });

  it("keeps the dismiss ('Şimdi Değil') button working as before", async () => {
    startContentRuntime({ platform: "meet", classify: () => "joined", settingsEnabledKey: "meetDetectionEnabled" });
    await flush();

    document.querySelector<HTMLButtonElement>('[data-action="dismiss"]')?.click();
    expect(document.getElementById("not-defteri-banner")).toBeNull();
  });
});

describe("recording state propagation to the banner", () => {
  it("shows a live recording indicator once STATE_UPDATED reports phase: recording", async () => {
    startContentRuntime({ platform: "meet", classify: () => "idle", settingsEnabledKey: "meetDetectionEnabled" });
    await flush();

    await fake.emitMessage({
      type: "STATE_UPDATED",
      state: baseState({ phase: "recording", recordingStartedAt: Date.now() - 5000 }),
    });

    expect(document.getElementById("not-defteri-banner")?.textContent).toContain("Kayıt yapılıyor");
  });

  it("surfaces a backend errorMessage as a banner notice", async () => {
    startContentRuntime({ platform: "meet", classify: () => "idle", settingsEnabledKey: "meetDetectionEnabled" });
    await flush();

    await fake.emitMessage({
      type: "STATE_UPDATED",
      state: baseState({ phase: "idle", errorMessage: "Kayıt başlatılamadı: test hatası." }),
    });

    expect(document.getElementById("not-defteri-banner")?.textContent).toContain("Kayıt başlatılamadı: test hatası.");
  });
});
