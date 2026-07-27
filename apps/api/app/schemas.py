from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# --- Meeting ---


class MeetingCreate(BaseModel):
    title: str = Field(default="Adsız Toplantı", max_length=200)
    source_type: str = Field(default="upload")
    language: str = Field(default="tr")


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class MeetingSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    source_type: str
    status: str
    duration_seconds: float | None
    created_at: datetime
    updated_at: datetime
    is_demo: bool
    action_item_count: int = 0
    open_action_item_count: int = 0


class MeetingDetail(MeetingSummary):
    error_message: str | None = None
    original_filename: str | None = None
    language: str
    has_audio: bool = False


# --- Transcript ---


class TranscriptSegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    index: int
    start_time: float
    end_time: float
    text: str
    speaker_label: str | None = None


# --- Analysis ---


class MeetingAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    summary: str | None = None
    topics: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    unresolved_questions: list[str] = Field(default_factory=list)
    follow_ups: list[str] = Field(default_factory=list)
    source: str = "fallback"
    model_name: str | None = None
    updated_at: datetime | None = None


class AnalysisLLMResult(BaseModel):
    """Schema the LLM (or fallback) must produce."""

    summary: str = ""
    topics: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    unresolved_questions: list[str] = Field(default_factory=list)
    follow_ups: list[str] = Field(default_factory=list)


class ActionItemLLM(BaseModel):
    description: str
    assignee: str | None = None
    due_date: str | None = None
    priority: str = "medium"
    source_timestamp: float | None = None
    confidence: float = 0.5


class ActionItemListLLM(BaseModel):
    items: list[ActionItemLLM] = Field(default_factory=list)


# --- Action Items ---


class ActionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    description: str
    assignee: str | None
    due_date: str | None
    priority: str
    source_timestamp: float | None
    confidence: float | None
    is_completed: bool
    source: str
    created_at: datetime


class ActionItemCreate(BaseModel):
    description: str = Field(min_length=1, max_length=1000)
    assignee: str | None = Field(default=None, max_length=100)
    due_date: str | None = Field(default=None, max_length=40)
    priority: str = Field(default="medium")


class ActionItemUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=1000)
    assignee: str | None = Field(default=None, max_length=100)
    due_date: str | None = Field(default=None, max_length=40)
    priority: str | None = None
    is_completed: bool | None = None


# --- Q&A ---


class QuestionCreate(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    chat_session_id: str | None = None


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question: str
    answer: str
    source_timestamps: list[float] = Field(default_factory=list)
    grounded: bool
    source: str
    chat_session_id: str
    created_at: datetime


# --- Processing status ---


class ProcessingStatus(BaseModel):
    status: str
    stage_label: str
    error_message: str | None = None
