import { NO_AUDIO_TRACK_MESSAGE } from "../lib/constants";
import type { ExtensionMessage } from "../lib/messages";
import { pickSupportedMimeType, RECORDING_FILE_EXTENSION } from "../lib/mime";
import {
  canStartRecording,
  canStopRecording,
  collectChunk,
  createBlobOnce,
  hasAudioTrack,
  type BlobOnceGuard,
  type RecordingPhase,
} from "../lib/recording-guard";
import type { ExtensionSettings } from "../lib/settings";
import { normalizeUrl } from "../lib/settings";
import { type BackendClient, runUploadPipeline } from "../lib/upload";

// chrome.tabCapture's stream-id constraint is a non-standard Chrome extension to
// MediaTrackConstraints, not covered by the DOM lib types.
interface TabCaptureAudioConstraints extends MediaTrackConstraints {
  mandatory: {
    chromeMediaSource: "tab";
    chromeMediaSourceId: string;
  };
}

let phase: RecordingPhase = "idle";
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
const blobGuard: BlobOnceGuard = { created: false };
let finalBlob: Blob | null = null;
let pendingMeetingId: string | null = null;
let currentSettings: ExtensionSettings | null = null;

function post(message: ExtensionMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // Background may briefly not have a listener attached; safe to ignore.
  });
}

function cleanupTracks(): void {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  if (audioContext && audioContext.state !== "closed") {
    void audioContext.close().catch(() => {});
  }
  audioContext = null;
}

async function startRecording(streamId: string, settings: ExtensionSettings): Promise<void> {
  if (!canStartRecording(phase)) return; // dedupe: a recording is already in progress

  currentSettings = settings;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      } as TabCaptureAudioConstraints,
      video: false,
    });
  } catch (err) {
    console.error("[not-defteri] getUserMedia(tab) failed", err instanceof Error ? err.message : String(err));
    post({ type: "OFFSCREEN_NO_AUDIO" });
    return;
  }

  if (!hasAudioTrack(stream)) {
    stream.getTracks().forEach((track) => track.stop());
    console.warn(NO_AUDIO_TRACK_MESSAGE);
    post({ type: "OFFSCREEN_NO_AUDIO" });
    return;
  }

  mediaStream = stream;

  // chrome.tabCapture silences the tab's own audio output unless it's explicitly replayed —
  // route the captured track back to the speakers so the meeting stays audible while recording.
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(audioContext.destination);
  if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});

  stream.getAudioTracks()[0].addEventListener("ended", () => {
    post({ type: "OFFSCREEN_TRACK_ENDED" });
  });

  chunks = [];
  blobGuard.created = false;
  finalBlob = null;

  const mimeType = pickSupportedMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (err) {
    console.error("[not-defteri] MediaRecorder construction failed", err instanceof Error ? err.message : String(err));
    cleanupTracks();
    post({ type: "OFFSCREEN_RECORDER_FAILED" });
    return;
  }

  recorder.ondataavailable = (event) => collectChunk(chunks, event.data);
  recorder.onerror = (event) => {
    console.error("[not-defteri] MediaRecorder error", event);
  };
  recorder.onstop = () => {
    phase = "stopped";
    finalBlob = createBlobOnce(blobGuard, chunks, recorder.mimeType || mimeType);
    void handleRecordingStopped();
  };

  try {
    recorder.start(1000);
  } catch (err) {
    console.error("[not-defteri] MediaRecorder.start() failed", err instanceof Error ? err.message : String(err));
    cleanupTracks();
    post({ type: "OFFSCREEN_RECORDER_FAILED" });
    return;
  }

  mediaRecorder = recorder;
  phase = "recording";
  post({ type: "OFFSCREEN_RECORDING_STARTED" });
}

function stopRecording(): void {
  if (!canStopRecording(phase)) return; // dedupe: already stopped/stopping/never started
  mediaRecorder?.stop();
  cleanupTracks();
}

async function handleRecordingStopped(): Promise<void> {
  cleanupTracks();
  if (!finalBlob || !currentSettings) return;
  await runPipeline(currentSettings, finalBlob);
}

async function runPipeline(settings: ExtensionSettings, blob: Blob): Promise<void> {
  const client: BackendClient = { fetchImpl: fetch.bind(window), backendUrl: normalizeUrl(settings.backendUrl) };
  const filename = `toplanti-${Date.now()}${RECORDING_FILE_EXTENSION}`;
  const title = `Toplantı Kaydı ${new Date().toLocaleString("tr-TR")}`;

  try {
    const result = await runUploadPipeline(
      client,
      blob,
      filename,
      title,
      {
        onStage: (stage, extra) => {
          if (extra?.meetingId) pendingMeetingId = extra.meetingId;
          post({
            type: "OFFSCREEN_UPLOAD_STAGE",
            stage,
            meetingId: extra?.meetingId,
            errorMessage: extra?.errorMessage,
          });
        },
      },
      { existingMeetingId: pendingMeetingId ?? undefined }
    );
    pendingMeetingId = result.meetingId;
  } catch {
    // The pipeline already reported the specific failure stage via onStage above.
  }
}

async function retryUpload(settings: ExtensionSettings): Promise<void> {
  if (!finalBlob) return; // nothing retained to retry (already discarded, or never recorded)
  currentSettings = settings;
  await runPipeline(settings, finalBlob);
}

function downloadRecording(): void {
  if (!finalBlob) return;
  const url = URL.createObjectURL(finalBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `toplanti-kaydi-${Date.now()}${RECORDING_FILE_EXTENSION}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function discardRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  cleanupTracks();
  chunks = [];
  finalBlob = null;
  pendingMeetingId = null;
  blobGuard.created = false;
  phase = "idle";
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (!("target" in message) || message.target !== "offscreen") return;

  switch (message.type) {
    case "OFFSCREEN_START_RECORDING":
      void startRecording(message.streamId, message.settings);
      break;
    case "OFFSCREEN_STOP_RECORDING":
      stopRecording();
      break;
    case "OFFSCREEN_RETRY_UPLOAD":
      void retryUpload(message.settings);
      break;
    case "OFFSCREEN_DOWNLOAD_RECORDING":
      downloadRecording();
      break;
    case "OFFSCREEN_DISCARD_RECORDING":
      discardRecording();
      break;
    default:
      break;
  }
});
