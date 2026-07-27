from pathlib import Path

from app import models
from app.database import SessionLocal
from app.services import pipeline, storage, transcription
from app.services.transcription import NoSpeechDetectedError


def _create_meeting_with_media(client) -> str:
    resp = client.post(
        "/api/meetings", json={"title": "No Speech Test", "source_type": "upload", "language": "tr"}
    )
    meeting_id = resp.json()["id"]
    client.post(
        f"/api/meetings/{meeting_id}/media",
        files={"file": ("ses.wav", b"RIFF....WAVEfmt fake audio bytes", "audio/wav")},
    )
    return meeting_id


def test_pipeline_surfaces_clear_error_when_no_speech_detected(client, monkeypatch):
    meeting_id = _create_meeting_with_media(client)

    monkeypatch.setattr(storage, "convert_to_wav", lambda src, mid: Path("fake.wav"))
    monkeypatch.setattr(storage, "probe_duration_seconds", lambda path: 3.0)

    def _raise_no_speech(*args, **kwargs):
        raise NoSpeechDetectedError(
            "Ses dosyasında konuşma algılanamadı. Dosyanın sessiz olmadığından emin olun."
        )

    monkeypatch.setattr(transcription, "transcribe_audio", _raise_no_speech)

    pipeline.run_full_pipeline(meeting_id, str(Path("fake_source.wav")))

    db = SessionLocal()
    try:
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        assert meeting.status == "error"
        assert "konuşma algılanamadı" in meeting.error_message
        segments = (
            db.query(models.TranscriptSegment).filter(models.TranscriptSegment.meeting_id == meeting_id).all()
        )
        assert segments == []
        analysis_row = (
            db.query(models.MeetingAnalysis).filter(models.MeetingAnalysis.meeting_id == meeting_id).first()
        )
        assert analysis_row is None
    finally:
        db.close()


def test_pipeline_succeeds_and_never_analyzes_empty_transcript(client, monkeypatch):
    meeting_id = _create_meeting_with_media(client)

    monkeypatch.setattr(storage, "convert_to_wav", lambda src, mid: Path("fake.wav"))
    monkeypatch.setattr(storage, "probe_duration_seconds", lambda path: 3.0)

    class _Result:
        def __init__(self):
            self.segments = [
                transcription.TranscriptSegmentResult(
                    0, 0.0, 2.0, "Merhaba, karar verildi ki devam edeceğiz."
                )
            ]
            self.language = "tr"
            self.duration = 2.0

    monkeypatch.setattr(transcription, "transcribe_audio", lambda *a, **kw: _Result())

    pipeline.run_full_pipeline(meeting_id, str(Path("fake_source.wav")))

    db = SessionLocal()
    try:
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        assert meeting.status == "ready"
        assert meeting.error_message is None
        analysis_row = (
            db.query(models.MeetingAnalysis).filter(models.MeetingAnalysis.meeting_id == meeting_id).first()
        )
        assert analysis_row is not None
        assert analysis_row.summary
    finally:
        db.close()
