import json
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.services import export as export_service
from app.services import pipeline, qa, storage
from app.services.pipeline import stage_label_for

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def _get_meeting_or_404(db: Session, meeting_id: str) -> models.Meeting:
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Toplantı bulunamadı.")
    return meeting


def _to_summary(meeting: models.Meeting) -> schemas.MeetingSummary:
    open_count = sum(1 for i in meeting.action_items if not i.is_completed)
    return schemas.MeetingSummary(
        id=meeting.id,
        title=meeting.title,
        source_type=meeting.source_type,
        status=meeting.status,
        duration_seconds=meeting.duration_seconds,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        is_demo=meeting.is_demo,
        action_item_count=len(meeting.action_items),
        open_action_item_count=open_count,
    )


@router.post("", response_model=schemas.MeetingDetail, status_code=201)
def create_meeting(payload: schemas.MeetingCreate, db: Session = Depends(get_db)):
    meeting = models.Meeting(
        title=payload.title or "Adsız Toplantı",
        source_type=payload.source_type,
        language=payload.language,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return _to_detail(meeting)


def _to_detail(meeting: models.Meeting) -> schemas.MeetingDetail:
    base = _to_summary(meeting)
    return schemas.MeetingDetail(
        **base.model_dump(),
        error_message=meeting.error_message,
        original_filename=meeting.original_filename,
        language=meeting.language,
        has_audio=bool(meeting.media_path),
    )


@router.get("", response_model=list[schemas.MeetingSummary])
def list_meetings(
    search: str | None = None,
    status_filter: str | None = None,
    sort: str = "newest",
    db: Session = Depends(get_db),
):
    query = db.query(models.Meeting)

    if search:
        like = f"%{search}%"
        query = query.outerjoin(models.TranscriptSegment).filter(
            or_(models.Meeting.title.ilike(like), models.TranscriptSegment.text.ilike(like))
        ).distinct()

    if status_filter:
        query = query.filter(models.Meeting.status == status_filter)

    if sort == "oldest":
        query = query.order_by(models.Meeting.created_at.asc())
    elif sort == "duration":
        query = query.order_by(models.Meeting.duration_seconds.desc().nullslast())
    else:
        query = query.order_by(models.Meeting.created_at.desc())

    meetings = query.all()
    return [_to_summary(m) for m in meetings]


@router.get("/{meeting_id}", response_model=schemas.MeetingDetail)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    return _to_detail(meeting)


@router.patch("/{meeting_id}", response_model=schemas.MeetingDetail)
def update_meeting(meeting_id: str, payload: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    if payload.title is not None:
        stripped = payload.title.strip()
        if not stripped:
            raise HTTPException(status_code=400, detail="Başlık boş olamaz.")
        meeting.title = stripped
    db.commit()
    db.refresh(meeting)
    return _to_detail(meeting)


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    db.delete(meeting)
    db.commit()
    storage.delete_meeting_files(meeting_id)
    return None


@router.post("/{meeting_id}/media", response_model=schemas.MeetingDetail)
def upload_media(meeting_id: str, file: UploadFile, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    ext = storage.validate_upload(file)
    dest = storage.save_upload(file, meeting_id, ext)

    meeting.media_path = str(dest)
    meeting.original_filename = storage.sanitize_filename(file.filename or "dosya")
    meeting.status = "uploaded"
    meeting.error_message = None
    db.commit()
    db.refresh(meeting)
    return _to_detail(meeting)


@router.post("/{meeting_id}/process", response_model=schemas.ProcessingStatus)
def start_processing(meeting_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    if not meeting.media_path:
        raise HTTPException(status_code=400, detail="Önce bir ses/video dosyası yükleyin.")
    if meeting.status == "processing":
        raise HTTPException(status_code=409, detail="Bu toplantı zaten işleniyor.")

    meeting.status = "processing"
    meeting.processing_stage = "preparing"
    meeting.error_message = None
    db.commit()

    background_tasks.add_task(pipeline.run_full_pipeline, meeting_id, meeting.media_path)
    return schemas.ProcessingStatus(status=meeting.status, stage_label=stage_label_for(meeting.status, meeting.processing_stage))


@router.post("/{meeting_id}/analyze", response_model=schemas.ProcessingStatus)
def regenerate_analysis(meeting_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    if meeting.status not in ("transcribed", "ready", "error"):
        raise HTTPException(status_code=400, detail="Analiz için önce dökümün hazır olması gerekiyor.")

    has_segments = (
        db.query(models.TranscriptSegment).filter(models.TranscriptSegment.meeting_id == meeting_id).count() > 0
    )
    if not has_segments:
        raise HTTPException(status_code=400, detail="Yeniden analiz için önce döküm oluşturulmalı.")

    meeting.status = "processing"
    meeting.processing_stage = "summarizing"
    meeting.error_message = None
    db.commit()

    background_tasks.add_task(pipeline.run_analysis_only, meeting_id)
    return schemas.ProcessingStatus(status=meeting.status, stage_label=stage_label_for(meeting.status, meeting.processing_stage))


@router.get("/{meeting_id}/status", response_model=schemas.ProcessingStatus)
def get_status(meeting_id: str, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    return schemas.ProcessingStatus(
        status=meeting.status,
        stage_label=stage_label_for(meeting.status, meeting.processing_stage),
        error_message=meeting.error_message,
    )


@router.get("/{meeting_id}/transcript", response_model=list[schemas.TranscriptSegmentOut])
def get_transcript(meeting_id: str, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, meeting_id)
    segments = (
        db.query(models.TranscriptSegment)
        .filter(models.TranscriptSegment.meeting_id == meeting_id)
        .order_by(models.TranscriptSegment.start_time)
        .all()
    )
    return segments


@router.get("/{meeting_id}/analysis", response_model=schemas.MeetingAnalysisOut | None)
def get_analysis(meeting_id: str, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, meeting_id)
    a = db.query(models.MeetingAnalysis).filter(models.MeetingAnalysis.meeting_id == meeting_id).first()
    if not a:
        return None
    return schemas.MeetingAnalysisOut(
        summary=a.summary,
        topics=json.loads(a.topics_json or "[]"),
        decisions=json.loads(a.decisions_json or "[]"),
        risks=json.loads(a.risks_json or "[]"),
        unresolved_questions=json.loads(a.unresolved_questions_json or "[]"),
        follow_ups=json.loads(a.follow_ups_json or "[]"),
        source=a.source,
        model_name=a.model_name,
        updated_at=a.updated_at,
    )


@router.get("/{meeting_id}/audio")
def get_audio(meeting_id: str, db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    if not meeting.media_path or not Path(meeting.media_path).exists():
        raise HTTPException(status_code=404, detail="Ses dosyası bulunamadı.")
    return FileResponse(meeting.media_path)


@router.get("/{meeting_id}/export")
def export_meeting(meeting_id: str, kind: str = "transcript", fmt: str = "txt", db: Session = Depends(get_db)):
    meeting = _get_meeting_or_404(db, meeting_id)
    segments = (
        db.query(models.TranscriptSegment)
        .filter(models.TranscriptSegment.meeting_id == meeting_id)
        .order_by(models.TranscriptSegment.start_time)
        .all()
    )

    if kind == "transcript":
        if fmt == "md":
            lines = [f"# {meeting.title} — Konuşma Metni", ""]
            from app.services.analysis import _format_ts

            lines += [f"- **[{_format_ts(s.start_time)}]** {s.text}" for s in segments]
            content = "\n".join(lines)
            media_type = "text/markdown"
        else:
            content = export_service.transcript_to_txt(meeting, segments)
            media_type = "text/plain"
    elif kind == "notes":
        analysis = db.query(models.MeetingAnalysis).filter(models.MeetingAnalysis.meeting_id == meeting_id).first()
        action_items = (
            db.query(models.ActionItem).filter(models.ActionItem.meeting_id == meeting_id).all()
        )
        content = export_service.notes_to_markdown(meeting, analysis, action_items)
        media_type = "text/markdown"
    else:
        raise HTTPException(status_code=400, detail="Geçersiz dışa aktarma türü.")

    return PlainTextResponse(content, media_type=f"{media_type}; charset=utf-8")


# --- Action items ---

@router.get("/{meeting_id}/action-items", response_model=list[schemas.ActionItemOut])
def list_action_items(meeting_id: str, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, meeting_id)
    return (
        db.query(models.ActionItem)
        .filter(models.ActionItem.meeting_id == meeting_id)
        .order_by(models.ActionItem.created_at)
        .all()
    )


@router.post("/{meeting_id}/action-items", response_model=schemas.ActionItemOut, status_code=201)
def create_action_item(meeting_id: str, payload: schemas.ActionItemCreate, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, meeting_id)
    item = models.ActionItem(
        meeting_id=meeting_id,
        description=payload.description,
        assignee=payload.assignee,
        due_date=payload.due_date,
        priority=payload.priority,
        source="manual",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{meeting_id}/action-items/{item_id}", response_model=schemas.ActionItemOut)
def update_action_item(meeting_id: str, item_id: str, payload: schemas.ActionItemUpdate, db: Session = Depends(get_db)):
    item = (
        db.query(models.ActionItem)
        .filter(models.ActionItem.id == item_id, models.ActionItem.meeting_id == meeting_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Görev bulunamadı.")

    for field in ("description", "assignee", "due_date", "priority", "is_completed"):
        value = getattr(payload, field)
        if value is not None:
            setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{meeting_id}/action-items/{item_id}", status_code=204)
def delete_action_item(meeting_id: str, item_id: str, db: Session = Depends(get_db)):
    item = (
        db.query(models.ActionItem)
        .filter(models.ActionItem.id == item_id, models.ActionItem.meeting_id == meeting_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Görev bulunamadı.")
    db.delete(item)
    db.commit()
    return None


# --- Q&A ---

@router.post("/{meeting_id}/questions", response_model=schemas.QuestionOut, status_code=201)
def ask_question(meeting_id: str, payload: schemas.QuestionCreate, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, meeting_id)
    segments = (
        db.query(models.TranscriptSegment)
        .filter(models.TranscriptSegment.meeting_id == meeting_id)
        .order_by(models.TranscriptSegment.start_time)
        .all()
    )
    if not segments:
        raise HTTPException(status_code=400, detail="Bu toplantı için henüz bir döküm yok.")

    answer, timestamps, grounded, source, model_name = qa.answer_question(segments, payload.question)

    question_row = models.MeetingQuestion(
        meeting_id=meeting_id,
        question=payload.question,
        answer=answer,
        source_timestamps_json=json.dumps(timestamps),
        grounded=grounded,
        source=source,
        chat_session_id=payload.chat_session_id or str(uuid.uuid4()),
    )
    db.add(question_row)
    db.commit()
    db.refresh(question_row)

    return schemas.QuestionOut(
        id=question_row.id,
        question=question_row.question,
        answer=question_row.answer,
        source_timestamps=timestamps,
        grounded=question_row.grounded,
        source=question_row.source,
        chat_session_id=question_row.chat_session_id,
        created_at=question_row.created_at,
    )


@router.get("/{meeting_id}/questions", response_model=list[schemas.QuestionOut])
def list_questions(meeting_id: str, chat_session_id: str | None = None, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, meeting_id)
    query = db.query(models.MeetingQuestion).filter(models.MeetingQuestion.meeting_id == meeting_id)
    if chat_session_id:
        query = query.filter(models.MeetingQuestion.chat_session_id == chat_session_id)
    rows = query.order_by(models.MeetingQuestion.created_at).all()
    return [
        schemas.QuestionOut(
            id=r.id,
            question=r.question,
            answer=r.answer,
            source_timestamps=json.loads(r.source_timestamps_json or "[]"),
            grounded=r.grounded,
            source=r.source,
            chat_session_id=r.chat_session_id,
            created_at=r.created_at,
        )
        for r in rows
    ]
