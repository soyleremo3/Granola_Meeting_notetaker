import { BACKEND_UNAVAILABLE_MESSAGE, STATUS_POLL_INTERVAL_MS, STATUS_POLL_TIMEOUT_MS } from "./constants";
import type { UploadStage } from "./messages";

export interface BackendClient {
  fetchImpl: typeof fetch;
  backendUrl: string;
}

/** Thrown when fetch itself rejects (DNS/connection failure) — the backend process isn't running. */
export class BackendUnavailableError extends Error {}

/** Thrown when the backend responded but with a non-2xx status. */
export class BackendHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface MeetingDetail {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface ProcessingStatus {
  status: string;
  stage_label: string;
  error_message: string | null;
}

async function backendRequest<T>(client: BackendClient, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await client.fetchImpl(`${client.backendUrl}${path}`, init);
  } catch (err) {
    throw new BackendUnavailableError(err instanceof Error ? err.message : String(err));
  }

  if (!res.ok) {
    let detail = `Sunucu hatası (${res.status}).`;
    try {
      const data = (await res.json()) as { detail?: unknown };
      if (typeof data.detail === "string") detail = data.detail;
    } catch {
      // response body wasn't JSON — keep the generic message
    }
    throw new BackendHttpError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function createMeeting(client: BackendClient, title: string): Promise<MeetingDetail> {
  return backendRequest<MeetingDetail>(client, "/api/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, source_type: "recording", language: "tr" }),
  });
}

export function uploadRecording(
  client: BackendClient,
  meetingId: string,
  blob: Blob,
  filename: string
): Promise<MeetingDetail> {
  const form = new FormData();
  form.append("file", blob, filename);
  return backendRequest<MeetingDetail>(client, `/api/meetings/${meetingId}/media`, {
    method: "POST",
    body: form,
  });
}

export function startProcessing(client: BackendClient, meetingId: string): Promise<ProcessingStatus> {
  return backendRequest<ProcessingStatus>(client, `/api/meetings/${meetingId}/process`, { method: "POST" });
}

export function getStatus(client: BackendClient, meetingId: string): Promise<ProcessingStatus> {
  return backendRequest<ProcessingStatus>(client, `/api/meetings/${meetingId}/status`);
}

export function isTerminalStatus(status: string): boolean {
  return status === "ready" || status === "error";
}

export interface UploadStageExtra {
  meetingId?: string;
  errorMessage?: string;
  /** The backend's own granular stage_label (e.g. "Türkçe konuşma metne çevriliyor"), while processing. */
  stageLabel?: string;
}

export interface UploadPipelineCallbacks {
  onStage: (stage: UploadStage, extra?: UploadStageExtra) => void;
}

export interface UploadPipelineOptions {
  /** Resume an already-created meeting (retry after the upload/process step failed). */
  existingMeetingId?: string;
  pollFn?: (client: BackendClient, meetingId: string) => Promise<ProcessingStatus>;
  waitFn?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

export interface UploadPipelineResult {
  meetingId: string;
  finalStatus: "ready" | "error";
  errorMessage: string | null;
}

function reportFailure(
  err: unknown,
  callbacks: UploadPipelineCallbacks,
  meetingId: string | undefined
): void {
  if (err instanceof BackendUnavailableError) {
    callbacks.onStage("backend-unavailable", { meetingId, errorMessage: BACKEND_UNAVAILABLE_MESSAGE });
    return;
  }
  const message = err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.";
  callbacks.onStage("upload-failed", { meetingId, errorMessage: message });
}

/**
 * Runs (or resumes) the full create → upload → process → poll flow, reporting each stage via
 * `callbacks.onStage` so the caller (the offscreen document, which owns the recorded Blob) can
 * relay progress to the background service worker. Reusable for the initial attempt and for the
 * "Tekrar Yükle" retry — pass `existingMeetingId` to skip re-creating the meeting.
 */
export async function runUploadPipeline(
  client: BackendClient,
  blob: Blob,
  filename: string,
  title: string,
  callbacks: UploadPipelineCallbacks,
  options: UploadPipelineOptions = {}
): Promise<UploadPipelineResult> {
  const pollFn = options.pollFn ?? getStatus;
  const waitFn = options.waitFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const pollIntervalMs = options.pollIntervalMs ?? STATUS_POLL_INTERVAL_MS;
  const pollTimeoutMs = options.pollTimeoutMs ?? STATUS_POLL_TIMEOUT_MS;

  let meetingId = options.existingMeetingId;

  if (!meetingId) {
    callbacks.onStage("creating-meeting");
    let meeting: MeetingDetail;
    try {
      meeting = await createMeeting(client, title);
    } catch (err) {
      reportFailure(err, callbacks, undefined);
      throw err;
    }
    meetingId = meeting.id;
  }

  callbacks.onStage("uploading", { meetingId });
  try {
    await uploadRecording(client, meetingId, blob, filename);
  } catch (err) {
    reportFailure(err, callbacks, meetingId);
    throw err;
  }

  callbacks.onStage("starting-processing", { meetingId });
  try {
    await startProcessing(client, meetingId);
  } catch (err) {
    reportFailure(err, callbacks, meetingId);
    throw err;
  }

  callbacks.onStage("processing", { meetingId });
  const startedAt = Date.now();
  let status: ProcessingStatus;
  for (;;) {
    await waitFn(pollIntervalMs);
    try {
      status = await pollFn(client, meetingId);
    } catch (err) {
      reportFailure(err, callbacks, meetingId);
      throw err;
    }
    if (isTerminalStatus(status.status)) break;
    callbacks.onStage("processing", { meetingId, stageLabel: status.stage_label });
    if (Date.now() - startedAt > pollTimeoutMs) {
      const errorMessage = "Zaman aşımı: işlem beklenenden uzun sürdü.";
      callbacks.onStage("processing-failed", { meetingId, errorMessage });
      return { meetingId, finalStatus: "error", errorMessage };
    }
  }

  if (status.status === "ready") {
    callbacks.onStage("ready", { meetingId });
    return { meetingId, finalStatus: "ready", errorMessage: null };
  }

  callbacks.onStage("processing-failed", { meetingId, errorMessage: status.error_message ?? undefined });
  return { meetingId, finalStatus: "error", errorMessage: status.error_message };
}
