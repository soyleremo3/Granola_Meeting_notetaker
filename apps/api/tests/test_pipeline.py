from pathlib import Path

from app import models
from app.database import SessionLocal
from app.services import pipeline, storage, transcription
from app.services.storage import NO_AUDIO_STREAM_MESSAGE, NoAudioStreamError
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


def test_pipeline_surfaces_friendly_message_for_video_only_recording(client, monkeypatch):
    meeting_id = _create_meeting_with_media(client)

    def _raise_no_audio(*args, **kwargs):
        raise NoAudioStreamError(NO_AUDIO_STREAM_MESSAGE)

    monkeypatch.setattr(storage, "convert_to_wav", _raise_no_audio)

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Whisper must not run when the source has no audio stream")

    monkeypatch.setattr(transcription, "transcribe_audio", _fail_if_called)

    pipeline.run_full_pipeline(meeting_id, str(Path("fake_source.webm")))

    db = SessionLocal()
    try:
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        assert meeting.status == "error"
        assert meeting.error_message == NO_AUDIO_STREAM_MESSAGE
        assert "does not contain any stream" not in meeting.error_message
        assert "ffmpeg" not in meeting.error_message.lower()
    finally:
        db.close()


def test_transcript_preserved_when_analysis_stage_raises(client, monkeypatch):
    """Even if the analysis stage blows up unexpectedly, the already-committed transcript
    (Part 3, item 49/51) must never be lost — only the analysis is marked as failed."""
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

    from app.services import analysis as analysis_service

    def _raise(*args, **kwargs):
        raise RuntimeError("unexpected analysis crash")

    monkeypatch.setattr(analysis_service, "generate_meeting_analysis", _raise)

    pipeline.run_full_pipeline(meeting_id, str(Path("fake_source.wav")))

    db = SessionLocal()
    try:
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        assert meeting.status == "error"
        assert meeting.error_message

        segments = (
            db.query(models.TranscriptSegment).filter(models.TranscriptSegment.meeting_id == meeting_id).all()
        )
        assert len(segments) == 1
        assert segments[0].text == "Merhaba, karar verildi ki devam edeceğiz."
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
