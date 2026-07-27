"""Orchestrates the full processing pipeline: convert -> transcribe -> analyze -> save.

Runs as a FastAPI background task. Each stage updates `Meeting.processing_stage`
so the frontend can poll and show truthful, non-fabricated progress.
"""

import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal
from app.services import analysis, storage, transcription

logger = logging.getLogger(__name__)

STAGE_LABELS = {
    "preparing": "Dosya hazırlanıyor",
    "converting": "Ses dönüştürülüyor",
    "transcribing": "Türkçe konuşma metne çevriliyor",
    "summarizing": "Toplantı notları hazırlanıyor",
    "extracting_todos": "Yapılacak işler çıkarılıyor",
    "saving": "Sonuçlar kaydediliyor",
}


def stage_label_for(status: str, processing_stage: str | None) -> str:
    if status == "ready":
        return "Tamamlandı"
    if status == "error":
        return "Hata oluştu"
    if processing_stage and processing_stage in STAGE_LABELS:
        return STAGE_LABELS[processing_stage]
    return "Bekleniyor"


def run_full_pipeline(meeting_id: str, media_path_str: str) -> None:
    db = SessionLocal()
    try:
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if not meeting:
            return

        try:
            _set_stage(db, meeting, "processing", "preparing")
            media_path = Path(media_path_str)

            _set_stage(db, meeting, "processing", "converting")
            wav_path = storage.convert_to_wav(media_path, meeting_id)
            duration = storage.probe_duration_seconds(wav_path)

            _set_stage(db, meeting, "processing", "transcribing")
            result = transcription.transcribe_audio(wav_path, language=meeting.language)

            db.query(models.TranscriptSegment).filter(
                models.TranscriptSegment.meeting_id == meeting_id
            ).delete()
            for seg in result.segments:
                db.add(
                    models.TranscriptSegment(
                        meeting_id=meeting_id,
                        index=seg.index,
                        start_time=seg.start_time,
                        end_time=seg.end_time,
                        text=seg.text,
                    )
                )
            meeting.duration_seconds = duration or result.duration
            meeting.status = "transcribed"
            meeting.processing_stage = None
            db.commit()
            # Transcript is now durably saved — a later analysis failure will not lose it.

            run_analysis_only(meeting_id, db=db)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Pipeline failed for meeting %s", meeting_id)
            meeting.status = "error"
            meeting.processing_stage = None
            meeting.error_message = str(exc)[:500]
            db.commit()
    finally:
        db.close()


def run_analysis_only(meeting_id: str, db: Session | None = None) -> None:
    owns_session = db is None
    db = db or SessionLocal()
    try:
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if not meeting:
            return

        segments = (
            db.query(models.TranscriptSegment)
            .filter(models.TranscriptSegment.meeting_id == meeting_id)
            .order_by(models.TranscriptSegment.start_time)
            .all()
        )

        try:
            _set_stage(db, meeting, "processing", "summarizing")
            summary_result, summary_source, summary_model = analysis.generate_meeting_analysis(segments)

            existing = (
                db.query(models.MeetingAnalysis)
                .filter(models.MeetingAnalysis.meeting_id == meeting_id)
                .first()
            )
            if existing is None:
                existing = models.MeetingAnalysis(meeting_id=meeting_id)
                db.add(existing)

            existing.summary = summary_result.summary
            existing.topics_json = json.dumps(summary_result.topics, ensure_ascii=False)
            existing.decisions_json = json.dumps(summary_result.decisions, ensure_ascii=False)
            existing.risks_json = json.dumps(summary_result.risks, ensure_ascii=False)
            existing.unresolved_questions_json = json.dumps(
                summary_result.unresolved_questions, ensure_ascii=False
            )
            existing.follow_ups_json = json.dumps(summary_result.follow_ups, ensure_ascii=False)
            existing.source = summary_source
            existing.model_name = summary_model
            db.commit()

            _set_stage(db, meeting, "processing", "extracting_todos")
            items_result, items_source, _ = analysis.generate_action_items(segments)

            db.query(models.ActionItem).filter(
                models.ActionItem.meeting_id == meeting_id, models.ActionItem.source == "ai"
            ).delete()
            for item in items_result.items:
                db.add(
                    models.ActionItem(
                        meeting_id=meeting_id,
                        description=item.description,
                        assignee=item.assignee,
                        due_date=item.due_date,
                        priority=item.priority,
                        source_timestamp=item.source_timestamp,
                        confidence=item.confidence,
                        source="ai",
                    )
                )
            db.commit()

            _set_stage(db, meeting, "processing", "saving")
            meeting.status = "ready"
            meeting.processing_stage = None
            meeting.error_message = None
            db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Analysis failed for meeting %s", meeting_id)
            meeting.status = "error"
            meeting.processing_stage = None
            meeting.error_message = str(exc)[:500]
            db.commit()
    finally:
        if owns_session:
            db.close()


def _set_stage(db: Session, meeting: models.Meeting, status: str, stage: str) -> None:
    meeting.status = status
    meeting.processing_stage = stage
    db.commit()
