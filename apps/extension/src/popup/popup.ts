import type { ExtensionMessage, MeetingPhase, Platform, StateSnapshot } from "../lib/messages";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Beklenen popup öğesi bulunamadı: #${id}`);
  return el as T;
}

const platformRow = byId<HTMLElement>("platform-row");
const platformLabel = byId<HTMLElement>("platform-label");
const statusText = byId<HTMLElement>("status-text");
const timerText = byId<HTMLElement>("timer-text");
const errorText = byId<HTMLElement>("error-text");
const startBtn = byId<HTMLButtonElement>("start-btn");
const stopBtn = byId<HTMLButtonElement>("stop-btn");
const openResultBtn = byId<HTMLButtonElement>("open-result-btn");
const retryBtn = byId<HTMLButtonElement>("retry-btn");
const downloadBtn = byId<HTMLButtonElement>("download-btn");
const discardBtn = byId<HTMLButtonElement>("discard-btn");
const settingsBtn = byId<HTMLButtonElement>("settings-btn");

const PLATFORM_LABELS: Record<Platform, string> = {
  meet: "Google Meet",
  zoom: "Zoom Web Client",
};

const PHASE_LABELS: Record<MeetingPhase, string> = {
  idle: "Desteklenen bir toplantıya katılınca burada görünecek.",
  detected: "Toplantı algılandı",
  recording: "Kayıt yapılıyor",
  uploading: "Yükleniyor",
  processing: "Toplantı analiz ediliyor",
  ready: "Hazır",
  "upload-failed": "Yükleme başarısız oldu",
  "backend-unavailable": "Yerel sunucuya ulaşılamadı",
  "processing-failed": "Analiz başarısız oldu",
};

let tickTimer: ReturnType<typeof setInterval> | null = null;

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function hide(el: HTMLElement): void {
  el.hidden = true;
}

function show(el: HTMLElement): void {
  el.hidden = false;
}

function render(state: StateSnapshot): void {
  if (state.platform) {
    show(platformRow);
    platformLabel.textContent = PLATFORM_LABELS[state.platform];
  } else {
    hide(platformRow);
  }

  statusText.textContent =
    state.phase === "processing" && state.stageLabel ? state.stageLabel : PHASE_LABELS[state.phase];

  if (state.phase === "recording" && state.recordingStartedAt) {
    show(timerText);
    timerText.textContent = formatElapsed(Date.now() - state.recordingStartedAt);
    if (!tickTimer) {
      tickTimer = setInterval(() => {
        if (state.recordingStartedAt) timerText.textContent = formatElapsed(Date.now() - state.recordingStartedAt);
      }, 1000);
    }
  } else {
    hide(timerText);
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  if (state.errorMessage) {
    show(errorText);
    errorText.textContent = state.errorMessage;
  } else {
    hide(errorText);
  }

  hide(startBtn);
  hide(stopBtn);
  hide(openResultBtn);
  hide(retryBtn);
  hide(downloadBtn);
  hide(discardBtn);

  switch (state.phase) {
    case "detected":
      show(startBtn);
      break;
    case "recording":
      show(stopBtn);
      break;
    case "ready":
      show(openResultBtn);
      break;
    case "upload-failed":
    case "backend-unavailable":
      show(retryBtn);
      show(downloadBtn);
      show(discardBtn);
      break;
    case "processing-failed":
      show(downloadBtn);
      show(discardBtn);
      break;
    default:
      break;
  }
}

async function refresh(): Promise<void> {
  const state = (await chrome.runtime.sendMessage({ type: "GET_STATE_REQUESTED" } satisfies ExtensionMessage)) as
    | StateSnapshot
    | undefined;
  if (state) render(state);
}

startBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "START_RECORDING_REQUESTED" } satisfies ExtensionMessage);
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_RECORDING_REQUESTED" } satisfies ExtensionMessage);
});

openResultBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_RESULT_REQUESTED" } satisfies ExtensionMessage);
  window.close();
});

retryBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RETRY_UPLOAD_REQUESTED" } satisfies ExtensionMessage);
});

downloadBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "DOWNLOAD_RECORDING_REQUESTED" } satisfies ExtensionMessage);
});

discardBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "DISCARD_RECORDING_REQUESTED" } satisfies ExtensionMessage);
});

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "STATE_UPDATED") render(message.state);
});

void refresh();
