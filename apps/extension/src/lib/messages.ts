import type { ExtensionSettings } from "./settings";

export type Platform = "meet" | "zoom";

/** The overall lifecycle the popup and banner render a label for. */
export type MeetingPhase =
  | "idle"
  | "detected"
  | "recording"
  | "uploading"
  | "processing"
  | "ready"
  | "upload-failed"
  | "backend-unavailable"
  | "processing-failed";

export interface StateSnapshot {
  platform: Platform | null;
  tabId: number | null;
  phase: MeetingPhase;
  recordingStartedAt: number | null;
  meetingId: string | null;
  errorMessage: string | null;
  /** The backend's own granular stage_label (e.g. "Türkçe konuşma metne çevriliyor"), while processing. */
  stageLabel: string | null;
}

// --- Content script -> background ---

export interface MeetingDetectedMessage {
  type: "MEETING_DETECTED";
  platform: Platform;
}

export interface MeetingEndedMessage {
  type: "MEETING_ENDED";
  platform: Platform;
}

export interface ZoomDesktopOnlyMessage {
  type: "ZOOM_DESKTOP_ONLY_DETECTED";
}

// --- Content/popup -> background (user actions) ---

export interface StartRecordingRequestedMessage {
  type: "START_RECORDING_REQUESTED";
}

export interface StopRecordingRequestedMessage {
  type: "STOP_RECORDING_REQUESTED";
}

export interface RetryUploadRequestedMessage {
  type: "RETRY_UPLOAD_REQUESTED";
}

export interface DownloadRecordingRequestedMessage {
  type: "DOWNLOAD_RECORDING_REQUESTED";
}

export interface DiscardRecordingRequestedMessage {
  type: "DISCARD_RECORDING_REQUESTED";
}

export interface OpenResultRequestedMessage {
  type: "OPEN_RESULT_REQUESTED";
}

export interface GetStateRequestedMessage {
  type: "GET_STATE_REQUESTED";
}

// --- Background -> offscreen ---

export interface OffscreenStartRecordingMessage {
  type: "OFFSCREEN_START_RECORDING";
  target: "offscreen";
  streamId: string;
  settings: ExtensionSettings;
}

export interface OffscreenStopRecordingMessage {
  type: "OFFSCREEN_STOP_RECORDING";
  target: "offscreen";
}

export interface OffscreenRetryUploadMessage {
  type: "OFFSCREEN_RETRY_UPLOAD";
  target: "offscreen";
  settings: ExtensionSettings;
}

export interface OffscreenDownloadRecordingMessage {
  type: "OFFSCREEN_DOWNLOAD_RECORDING";
  target: "offscreen";
}

export interface OffscreenDiscardRecordingMessage {
  type: "OFFSCREEN_DISCARD_RECORDING";
  target: "offscreen";
}

// --- Offscreen -> background ---

export interface OffscreenNoAudioMessage {
  type: "OFFSCREEN_NO_AUDIO";
}

export interface OffscreenRecordingStartedMessage {
  type: "OFFSCREEN_RECORDING_STARTED";
}

export interface OffscreenTrackEndedMessage {
  type: "OFFSCREEN_TRACK_ENDED";
}

export type UploadStage =
  | "creating-meeting"
  | "uploading"
  | "starting-processing"
  | "processing"
  | "ready"
  | "upload-failed"
  | "backend-unavailable"
  | "processing-failed";

export interface OffscreenUploadStageMessage {
  type: "OFFSCREEN_UPLOAD_STAGE";
  stage: UploadStage;
  meetingId?: string;
  errorMessage?: string;
  stageLabel?: string;
}

// --- Background -> content/popup (broadcast) ---

export interface StateUpdatedMessage {
  type: "STATE_UPDATED";
  state: StateSnapshot;
}

export interface ZoomDesktopOnlyNoticeMessage {
  type: "ZOOM_DESKTOP_ONLY_NOTICE";
}

export type ExtensionMessage =
  | MeetingDetectedMessage
  | MeetingEndedMessage
  | ZoomDesktopOnlyMessage
  | StartRecordingRequestedMessage
  | StopRecordingRequestedMessage
  | RetryUploadRequestedMessage
  | DownloadRecordingRequestedMessage
  | DiscardRecordingRequestedMessage
  | OpenResultRequestedMessage
  | GetStateRequestedMessage
  | OffscreenStartRecordingMessage
  | OffscreenStopRecordingMessage
  | OffscreenRetryUploadMessage
  | OffscreenDownloadRecordingMessage
  | OffscreenDiscardRecordingMessage
  | OffscreenNoAudioMessage
  | OffscreenRecordingStartedMessage
  | OffscreenTrackEndedMessage
  | OffscreenUploadStageMessage
  | StateUpdatedMessage
  | ZoomDesktopOnlyNoticeMessage;

export function isOffscreenTargeted(
  message: ExtensionMessage
): message is
  | OffscreenStartRecordingMessage
  | OffscreenStopRecordingMessage
  | OffscreenRetryUploadMessage
  | OffscreenDownloadRecordingMessage
  | OffscreenDiscardRecordingMessage {
  return "target" in message && message.target === "offscreen";
}
