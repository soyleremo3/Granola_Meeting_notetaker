import { DETECTOR_DEBOUNCE_MS } from "../lib/constants";
import type { ExtensionMessage, Platform, StateSnapshot } from "../lib/messages";
import { DEFAULT_SETTINGS, loadSettings, type ExtensionSettings } from "../lib/settings";
import { showDetectedBanner, showRecordingBanner, showZoomDesktopOnlyNotice, removeBanner } from "./banner";
import type { MeetingState, PageSnapshot } from "./detectors/types";

/** How long the "ended" verdict must stay true before we act on it — absorbs momentary UI flicker. */
const ENDED_CONFIRM_MS = 1500;

/** Safety-net re-scan interval; the MutationObserver covers the common case, this catches the rest. */
const SAFETY_POLL_MS = 4000;

export interface DetectorAdapter {
  platform: Platform;
  classify(snapshot: PageSnapshot): MeetingState;
  isDesktopOnlyPrompt?(snapshot: PageSnapshot): boolean;
  settingsEnabledKey: "meetDetectionEnabled" | "zoomDetectionEnabled";
}

function captureSnapshot(): PageSnapshot {
  const ariaLabels = Array.from(document.querySelectorAll<HTMLElement>("[aria-label]"))
    .map((el) => el.getAttribute("aria-label") ?? "")
    .filter(Boolean);
  const bodyText = (document.body?.innerText ?? "").slice(0, 5000);
  return { url: location.href, ariaLabels, bodyText };
}

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function startContentRuntime(adapter: DetectorAdapter): void {
  let settings: ExtensionSettings = DEFAULT_SETTINGS;
  let joinedState: "idle" | "joined" = "idle";
  let pendingEndedSince: number | null = null;
  let bannerDismissed = false;
  let latestPhase: StateSnapshot["phase"] = "idle";
  let recordingStartedAt: number | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  function clearTick(): void {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function renderRecordingBanner(): void {
    if (!settings.inPageBannerEnabled || recordingStartedAt === null) return;
    showRecordingBanner(requestStop, formatElapsed(Date.now() - recordingStartedAt));
  }

  function requestStart(): void {
    chrome.runtime.sendMessage({ type: "START_RECORDING_REQUESTED" } satisfies ExtensionMessage);
  }

  function requestStop(): void {
    chrome.runtime.sendMessage({ type: "STOP_RECORDING_REQUESTED" } satisfies ExtensionMessage);
  }

  function handleDismiss(): void {
    bannerDismissed = true;
    removeBanner();
  }

  async function evaluate(): Promise<void> {
    settings = await loadSettings();
    if (!settings[adapter.settingsEnabledKey]) {
      removeBanner();
      return;
    }

    // A confirmed recording in progress takes priority over re-running join/end detection —
    // the banner just shows the live timer until the background tells us otherwise.
    if (latestPhase === "recording") return;

    const snapshot = captureSnapshot();

    if (adapter.isDesktopOnlyPrompt?.(snapshot)) {
      if (settings.inPageBannerEnabled) showZoomDesktopOnlyNotice();
      return;
    }

    const nextState = adapter.classify(snapshot);

    if (nextState === "ended") {
      if (pendingEndedSince === null) pendingEndedSince = Date.now();
      if (Date.now() - pendingEndedSince >= ENDED_CONFIRM_MS) {
        if (joinedState === "joined") {
          chrome.runtime.sendMessage({
            type: "MEETING_ENDED",
            platform: adapter.platform,
          } satisfies ExtensionMessage);
        }
        joinedState = "idle";
        bannerDismissed = false;
        removeBanner();
      }
      return;
    }
    pendingEndedSince = null;

    if (nextState === "joined") {
      if (joinedState !== "joined") {
        chrome.runtime.sendMessage({
          type: "MEETING_DETECTED",
          platform: adapter.platform,
        } satisfies ExtensionMessage);
      }
      joinedState = "joined";
      if (settings.inPageBannerEnabled && !bannerDismissed) {
        showDetectedBanner(requestStart, handleDismiss);
      }
      return;
    }

    joinedState = "idle";
    removeBanner();
  }

  const debouncedEvaluate = debounce(() => void evaluate(), DETECTOR_DEBOUNCE_MS);

  const observer = new MutationObserver(debouncedEvaluate);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label"],
  });

  setInterval(debouncedEvaluate, SAFETY_POLL_MS);
  void evaluate();

  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message.type !== "STATE_UPDATED") return;
    latestPhase = message.state.phase;

    if (message.state.phase === "recording") {
      recordingStartedAt = message.state.recordingStartedAt;
      renderRecordingBanner();
      if (!tickTimer) tickTimer = setInterval(renderRecordingBanner, 1000);
      return;
    }

    clearTick();
    recordingStartedAt = null;
    if (message.state.phase === "idle") {
      bannerDismissed = false;
      removeBanner();
      void evaluate();
    }
    // Uploading/processing/ready/error states are surfaced in the popup, not the in-page banner,
    // to keep the meeting UI uncluttered once the user has already left or stopped recording.
  });
}
