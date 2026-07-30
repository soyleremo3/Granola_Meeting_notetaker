import { isMeetUrl } from "../content/detectors/meet";
import { isZoomMeetingUrl } from "../content/detectors/zoom";
import {
  NO_AUDIO_TRACK_MESSAGE,
  OFFSCREEN_CREATE_FAILED_MESSAGE,
  RECORDER_START_FAILED_MESSAGE,
  TAB_CAPTURE_FAILED_MESSAGE,
} from "../lib/constants";
import type {
  ExtensionMessage,
  MeetingPhase,
  OffscreenUploadStageMessage,
  Platform,
  StartRecordingRequestedMessage,
} from "../lib/messages";
import { loadSettings, normalizeUrl } from "../lib/settings";
import { getState, resetState, setState } from "./state";

const OFFSCREEN_URL = "offscreen/offscreen.html";

// Guards a rapid double-click on "Kaydı Başlat" from racing two getMediaStreamId calls before the
// first has had a chance to move the state out of "detected".
let startInFlight = false;

async function ensureOffscreenDocument(): Promise<void> {
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Toplantı sekmesinin sesini MediaRecorder ile kaydetmek için kullanılıyor.",
  });
}

/** @types/chrome only declares the callback form for this method; wrap it as a Promise. */
function getTabCaptureStreamId(targetTabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        reject(new Error(chrome.runtime.lastError?.message ?? "Akış kimliği alınamadı."));
        return;
      }
      resolve(streamId);
    });
  });
}

function sendToOffscreen(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // No listener yet (offscreen document not created/ready) — safe to ignore.
  });
}

async function publishState(): Promise<void> {
  const state = await getState();
  const message: ExtensionMessage = { type: "STATE_UPDATED", state };
  chrome.runtime.sendMessage(message).catch(() => {
    // No popup/options page listening — expected most of the time.
  });
  if (state.tabId !== null) {
    chrome.tabs.sendMessage(state.tabId, message).catch(() => {
      // The tab may have no content script (already closed/navigated away) — expected.
    });
  }
}

async function handleMeetingDetected(platform: Platform, tabId: number): Promise<void> {
  const state = await getState();
  const busy = state.phase === "recording" || state.phase === "uploading" || state.phase === "processing";
  if (busy) {
    if (state.tabId !== tabId) return; // a different meeting is already in progress; ignore
    return;
  }
  // Any non-busy detection starts a fresh session, clearing whatever a previous meeting left
  // behind (a stale "ready"/"error" result, an old meetingId) so the next recording isn't blocked.
  await setState({
    platform,
    tabId,
    phase: "detected",
    meetingId: null,
    errorMessage: null,
    recordingStartedAt: null,
    stageLabel: null,
  });
  await publishState();
}

async function handleMeetingEnded(tabId: number): Promise<void> {
  const state = await getState();
  if (state.tabId !== tabId) return;

  if (state.phase === "recording") {
    const settings = await loadSettings();
    if (settings.autoStopEnabled) await stopRecording();
    return;
  }
  if (state.phase === "detected") {
    await resetState();
    await publishState();
  }
}

async function failStart(tabId: number, errorMessage: string): Promise<void> {
  await setState({ tabId, phase: "idle", errorMessage, recordingStartedAt: null });
  await publishState();
}

async function beginRecording(tabId: number, platform: Platform): Promise<void> {
  let streamId: string;
  try {
    streamId = await getTabCaptureStreamId(tabId);
  } catch (err) {
    console.error("[not-defteri] tabCapture.getMediaStreamId failed", {
      tabId,
      message: err instanceof Error ? err.message : String(err),
    });
    await failStart(tabId, TAB_CAPTURE_FAILED_MESSAGE);
    return;
  }

  try {
    await ensureOffscreenDocument();
  } catch (err) {
    console.error("[not-defteri] offscreen document creation failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    await failStart(tabId, OFFSCREEN_CREATE_FAILED_MESSAGE);
    return;
  }

  const settings = await loadSettings();
  await setState({ tabId, platform, phase: "detected", errorMessage: null });
  sendToOffscreen({ type: "OFFSCREEN_START_RECORDING", target: "offscreen", streamId, settings });
}

async function handleStartRequested(
  message: StartRecordingRequestedMessage,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  // Set the guard synchronously, before any await, so two rapid clicks handled in the same tick
  // can't both pass the check before either has had a chance to flip it.
  if (startInFlight) return;
  startInFlight = true;

  try {
    const state = await getState();
    // Prefer the tabId the popup queried explicitly at click time (chrome.tabs.query active/
    // currentWindow) — that is exactly the tab Chrome just granted tabCapture permission for by
    // the toolbar-icon click that opened the popup. sender.tab?.id covers non-popup callers.
    const tabId = message.tabId ?? sender.tab?.id ?? state.tabId;
    if (tabId === null || tabId === undefined) return;
    if (state.phase === "recording" || state.phase === "uploading" || state.phase === "processing") return;
    await beginRecording(tabId, state.platform ?? "meet");
  } finally {
    startInFlight = false;
  }
}

async function handleRecordingStarted(): Promise<void> {
  await setState({ phase: "recording", recordingStartedAt: Date.now(), errorMessage: null });
  await publishState();
}

async function handleNoAudio(): Promise<void> {
  console.error("[not-defteri] offscreen reported no audio track");
  await setState({ phase: "idle", errorMessage: NO_AUDIO_TRACK_MESSAGE, recordingStartedAt: null });
  await publishState();
}

async function handleRecorderFailed(): Promise<void> {
  console.error("[not-defteri] offscreen reported MediaRecorder failure");
  await setState({ phase: "idle", errorMessage: RECORDER_START_FAILED_MESSAGE, recordingStartedAt: null });
  await publishState();
}

async function stopRecording(): Promise<void> {
  const state = await getState();
  if (state.phase !== "recording") return; // idempotent: already stopped/stopping/never started
  await setState({ phase: "uploading" });
  await publishState();
  sendToOffscreen({ type: "OFFSCREEN_STOP_RECORDING", target: "offscreen" });
}

function collapseUploadStage(message: OffscreenUploadStageMessage): MeetingPhase {
  switch (message.stage) {
    case "creating-meeting":
    case "uploading":
      return "uploading";
    case "starting-processing":
    case "processing":
      return "processing";
    default:
      return message.stage;
  }
}

async function openResultAndReset(): Promise<void> {
  const state = await getState();
  const settings = await loadSettings();
  if (state.meetingId) {
    await chrome.tabs.create({ url: `${normalizeUrl(settings.frontendUrl)}/meetings/${state.meetingId}` });
  }
  await resetState();
  await publishState();
}

async function handleUploadStage(message: OffscreenUploadStageMessage): Promise<void> {
  const current = await getState();
  await setState({
    phase: collapseUploadStage(message),
    meetingId: message.meetingId ?? current.meetingId,
    errorMessage: message.errorMessage ?? null,
    stageLabel: message.stageLabel ?? null,
  });
  await publishState();

  if (message.stage === "ready") {
    // The upload succeeded and the backend now owns the audio — release the in-memory Blob and
    // free the offscreen document. Offscreen documents only have access to the runtime API, so
    // closeDocument() has to be called from here, not from within the offscreen document itself.
    sendToOffscreen({ type: "OFFSCREEN_DISCARD_RECORDING", target: "offscreen" });
    await chrome.offscreen.closeDocument().catch(() => {});
    const settings = await loadSettings();
    if (settings.autoOpenResultEnabled) await openResultAndReset();
  }
}

async function handleRetry(): Promise<void> {
  const state = await getState();
  if (state.phase !== "upload-failed" && state.phase !== "backend-unavailable") return;
  const settings = await loadSettings();
  await setState({ phase: "uploading", errorMessage: null });
  await publishState();
  sendToOffscreen({ type: "OFFSCREEN_RETRY_UPLOAD", target: "offscreen", settings });
}

async function handleDiscard(): Promise<void> {
  sendToOffscreen({ type: "OFFSCREEN_DISCARD_RECORDING", target: "offscreen" });
  await chrome.offscreen.closeDocument().catch(() => {});
  await resetState();
  await publishState();
}

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case "MEETING_DETECTED": {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) await handleMeetingDetected(message.platform, tabId);
      return undefined;
    }
    case "MEETING_ENDED": {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) await handleMeetingEnded(tabId);
      return undefined;
    }
    case "ZOOM_DESKTOP_ONLY_DETECTED":
      return undefined; // purely informational; the content script already shows its own notice
    case "START_RECORDING_REQUESTED":
      await handleStartRequested(message, sender);
      return undefined;
    case "STOP_RECORDING_REQUESTED":
      await stopRecording();
      return undefined;
    case "RETRY_UPLOAD_REQUESTED":
      await handleRetry();
      return undefined;
    case "DOWNLOAD_RECORDING_REQUESTED":
      sendToOffscreen({ type: "OFFSCREEN_DOWNLOAD_RECORDING", target: "offscreen" });
      return undefined;
    case "DISCARD_RECORDING_REQUESTED":
      await handleDiscard();
      return undefined;
    case "OPEN_RESULT_REQUESTED":
      await openResultAndReset();
      return undefined;
    case "GET_STATE_REQUESTED":
      return getState();
    case "OFFSCREEN_NO_AUDIO":
      await handleNoAudio();
      return undefined;
    case "OFFSCREEN_RECORDER_FAILED":
      await handleRecorderFailed();
      return undefined;
    case "OFFSCREEN_RECORDING_STARTED":
      await handleRecordingStarted();
      return undefined;
    case "OFFSCREEN_TRACK_ENDED":
      await stopRecording();
      return undefined;
    case "OFFSCREEN_UPLOAD_STAGE":
      await handleUploadStage(message);
      return undefined;
    default:
      return undefined;
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => {
      if (response !== undefined) sendResponse(response);
    })
    .catch((err) => {
      console.error("[not-defteri] message handling failed", err);
    });
  return true; // keep the channel open for the async response above
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const state = await getState();
    if (state.tabId !== tabId) return;
    if (state.phase === "recording") {
      await stopRecording();
    } else {
      await resetState();
      await publishState();
    }
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  void (async () => {
    const state = await getState();
    if (state.tabId !== tabId || state.phase !== "recording") return;
    const stillOnMeetingUrl =
      state.platform === "meet" ? isMeetUrl(changeInfo.url as string) : isZoomMeetingUrl(changeInfo.url as string);
    if (!stillOnMeetingUrl) await stopRecording();
  })();
});

chrome.runtime.onInstalled.addListener(() => {
  void resetState();
});
