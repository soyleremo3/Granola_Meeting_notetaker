import type {
  ActionItem,
  MeetingAnalysis,
  MeetingDetail,
  MeetingSummary,
  ProcessingStatus,
  Question,
  TranscriptSegment,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let detail = "Sunucu hatası oluştu.";
    try {
      const data = await res.json();
      detail = data.detail ?? detail;
    } catch {
      // ignore JSON parse errors on error responses
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => request<{ status: string; ai_enabled: boolean; whisper_model: string }>("/health"),

  listMeetings: (params?: { search?: string; sort?: string; status_filter?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.status_filter) query.set("status_filter", params.status_filter);
    const qs = query.toString();
    return request<MeetingSummary[]>(`/api/meetings${qs ? `?${qs}` : ""}`);
  },

  createMeeting: (payload: { title: string; source_type: "upload" | "recording"; language?: string }) =>
    request<MeetingDetail>("/api/meetings", { method: "POST", body: JSON.stringify(payload) }),

  getMeeting: (id: string) => request<MeetingDetail>(`/api/meetings/${id}`),

  updateMeeting: (id: string, payload: { title?: string }) =>
    request<MeetingDetail>(`/api/meetings/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteMeeting: (id: string) => request<void>(`/api/meetings/${id}`, { method: "DELETE" }),

  uploadMedia: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<MeetingDetail>(`/api/meetings/${id}/media`, { method: "POST", body: form });
  },

  uploadMediaWithProgress: (id: string, file: File, onProgress: (pct: number) => void) => {
    return new Promise<MeetingDetail>((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/api/meetings/${id}/media`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          let detail = "Yükleme başarısız oldu.";
          try {
            detail = JSON.parse(xhr.responseText).detail ?? detail;
          } catch {
            // ignore
          }
          reject(new ApiError(detail, xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError("Ağ hatası: dosya yüklenemedi.", 0));
      xhr.send(form);
    });
  },

  startProcessing: (id: string) =>
    request<ProcessingStatus>(`/api/meetings/${id}/process`, { method: "POST" }),

  regenerateAnalysis: (id: string) =>
    request<ProcessingStatus>(`/api/meetings/${id}/analyze`, { method: "POST" }),

  getStatus: (id: string) => request<ProcessingStatus>(`/api/meetings/${id}/status`),

  getTranscript: (id: string) => request<TranscriptSegment[]>(`/api/meetings/${id}/transcript`),

  getAnalysis: (id: string) => request<MeetingAnalysis | null>(`/api/meetings/${id}/analysis`),

  audioUrl: (id: string) => `${API_URL}/api/meetings/${id}/audio`,

  exportUrl: (id: string, kind: "transcript" | "notes", fmt: "txt" | "md") =>
    `${API_URL}/api/meetings/${id}/export?kind=${kind}&fmt=${fmt}`,

  listActionItems: (id: string) => request<ActionItem[]>(`/api/meetings/${id}/action-items`),

  createActionItem: (
    id: string,
    payload: { description: string; assignee?: string | null; due_date?: string | null; priority?: string }
  ) =>
    request<ActionItem>(`/api/meetings/${id}/action-items`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateActionItem: (
    meetingId: string,
    itemId: string,
    payload: Partial<{
      description: string;
      assignee: string | null;
      due_date: string | null;
      priority: string;
      is_completed: boolean;
    }>
  ) =>
    request<ActionItem>(`/api/meetings/${meetingId}/action-items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteActionItem: (meetingId: string, itemId: string) =>
    request<void>(`/api/meetings/${meetingId}/action-items/${itemId}`, { method: "DELETE" }),

  askQuestion: (id: string, payload: { question: string; chat_session_id?: string | null }) =>
    request<Question>(`/api/meetings/${id}/questions`, { method: "POST", body: JSON.stringify(payload) }),

  listQuestions: (id: string, chatSessionId?: string) =>
    request<Question[]>(
      `/api/meetings/${id}/questions${chatSessionId ? `?chat_session_id=${chatSessionId}` : ""}`
    ),
};
