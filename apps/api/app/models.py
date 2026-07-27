import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String, default="Adsız Toplantı")
    source_type: Mapped[str] = mapped_column(String, default="upload")  # upload | recording
    original_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    media_path: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    language: Mapped[str] = mapped_column(String, default="tr")

    status: Mapped[str] = mapped_column(String, default="uploaded")
    # uploaded | processing | transcribed | ready | error
    processing_stage: Mapped[str | None] = mapped_column(String, nullable=True)
    # preparing | converting | transcribing | summarizing | extracting_todos | saving
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(default=_now)
    updated_at: Mapped[datetime] = mapped_column(default=_now, onupdate=_now)

    segments: Mapped[list["TranscriptSegment"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="TranscriptSegment.start_time"
    )
    analysis: Mapped["MeetingAnalysis | None"] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", uselist=False
    )
    action_items: Mapped[list["ActionItem"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="ActionItem.created_at"
    )
    questions: Mapped[list["MeetingQuestion"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", order_by="MeetingQuestion.created_at"
    )


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[float] = mapped_column(Float)
    end_time: Mapped[float] = mapped_column(Float)
    text: Mapped[str] = mapped_column(Text)
    speaker_label: Mapped[str | None] = mapped_column(String, nullable=True)

    meeting: Mapped["Meeting"] = relationship(back_populates="segments")


class MeetingAnalysis(Base):
    __tablename__ = "meeting_analyses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"), unique=True, index=True)

    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    topics_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    decisions_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    risks_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    unresolved_questions_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_ups_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    source: Mapped[str] = mapped_column(String, default="fallback")  # openrouter | fallback
    model_name: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=_now)
    updated_at: Mapped[datetime] = mapped_column(default=_now, onupdate=_now)

    meeting: Mapped["Meeting"] = relationship(back_populates="analysis")


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"), index=True)

    description: Mapped[str] = mapped_column(Text)
    assignee: Mapped[str | None] = mapped_column(String, nullable=True)
    due_date: Mapped[str | None] = mapped_column(String, nullable=True)
    priority: Mapped[str] = mapped_column(String, default="medium")  # low | medium | high
    source_timestamp: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String, default="ai")  # ai | manual

    created_at: Mapped[datetime] = mapped_column(default=_now)
    updated_at: Mapped[datetime] = mapped_column(default=_now, onupdate=_now)

    meeting: Mapped["Meeting"] = relationship(back_populates="action_items")


class MeetingQuestion(Base):
    __tablename__ = "meeting_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id"), index=True)

    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    source_timestamps_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    grounded: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str] = mapped_column(String, default="fallback")  # openrouter | fallback
    chat_session_id: Mapped[str] = mapped_column(String, default=_uuid)

    created_at: Mapped[datetime] = mapped_column(default=_now)

    meeting: Mapped["Meeting"] = relationship(back_populates="questions")
