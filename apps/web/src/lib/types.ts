export type MeetingStatus = "uploaded" | "processing" | "transcribed" | "ready" | "error";

export interface MeetingSummary {
  id: string;
  title: string;
  source_type: "upload" | "recording";
  status: MeetingStatus;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
  action_item_count: number;
  open_action_item_count: number;
}

export interface MeetingDetail extends MeetingSummary {
  error_message: string | null;
  original_filename: string | null;
  language: string;
  has_audio: boolean;
}

export interface TranscriptSegment {
  id: string;
  index: number;
  start_time: number;
  end_time: number;
  text: string;
  speaker_label: string | null;
}

export interface MeetingAnalysis {
  summary: string | null;
  topics: string[];
  decisions: string[];
  risks: string[];
  unresolved_questions: string[];
  follow_ups: string[];
  source: "openrouter" | "fallback";
  model_name: string | null;
  updated_at: string | null;
}

export type Priority = "low" | "medium" | "high";

export interface ActionItem {
  id: string;
  description: string;
  assignee: string | null;
  due_date: string | null;
  priority: Priority;
  source_timestamp: number | null;
  confidence: number | null;
  is_completed: boolean;
  source: "ai" | "manual";
  created_at: string;
}

export interface Question {
  id: string;
  question: string;
  answer: string;
  source_timestamps: number[];
  grounded: boolean;
  source: "openrouter" | "fallback";
  chat_session_id: string;
  created_at: string;
}

export interface ProcessingStatus {
  status: MeetingStatus;
  stage_label: string;
  error_message: string | null;
}
