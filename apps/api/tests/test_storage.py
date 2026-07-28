import io
import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import storage
from app.services.storage import NO_AUDIO_STREAM_MESSAGE, NoAudioStreamError


def _fake_upload(data: bytes, filename: str = "recording.wav"):
    return SimpleNamespace(file=io.BytesIO(data), filename=filename)


def test_has_audio_stream_true_when_ffprobe_lists_an_audio_stream(monkeypatch):
    monkeypatch.setattr(
        storage.subprocess,
        "run",
        lambda *a, **kw: SimpleNamespace(stdout="0\n", stderr=""),
    )
    assert storage.has_audio_stream(Path("recording-with-audio.webm")) is True


def test_has_audio_stream_false_for_video_only_recording(monkeypatch):
    monkeypatch.setattr(
        storage.subprocess,
        "run",
        lambda *a, **kw: SimpleNamespace(stdout="", stderr=""),
    )
    assert storage.has_audio_stream(Path("video-only.webm")) is False


def test_convert_to_wav_raises_friendly_error_for_video_only_media(monkeypatch):
    monkeypatch.setattr(storage, "has_audio_stream", lambda path: False)

    def _fail_if_ffmpeg_runs(*args, **kwargs):
        raise AssertionError("ffmpeg should not run when no audio stream was detected")

    monkeypatch.setattr(storage.subprocess, "run", _fail_if_ffmpeg_runs)

    with pytest.raises(NoAudioStreamError) as exc_info:
        storage.convert_to_wav(Path("video-only.webm"), "meeting-1")

    assert str(exc_info.value) == NO_AUDIO_STREAM_MESSAGE
    assert "Output file does not contain any stream" not in str(exc_info.value)


def test_convert_to_wav_proceeds_to_ffmpeg_when_audio_stream_present(monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "has_audio_stream", lambda path: True)
    monkeypatch.setattr(storage.settings, "storage_dir", str(tmp_path))

    calls: list[list[str]] = []

    def _fake_run(cmd, **kwargs):
        calls.append(cmd)
        Path(cmd[-1]).write_bytes(b"fake-wav-bytes")
        return SimpleNamespace(returncode=0, stdout="", stderr="")

    monkeypatch.setattr(storage.subprocess, "run", _fake_run)

    dest = storage.convert_to_wav(Path("recording-with-audio.webm"), "meeting-2")

    assert dest.exists()
    assert len(calls) == 1
    assert "ffmpeg" in calls[0]


# --- Upload size limit (Part 1: MAX_UPLOAD_SIZE_MB=0 means unlimited) ---


def test_save_upload_unlimited_mode_accepts_large_file(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "storage_dir", str(tmp_path))
    monkeypatch.setattr(storage.settings, "max_upload_size_mb", 0)

    data = b"a" * (3 * 1024 * 1024 + 17)  # spans multiple 1MB read chunks
    dest = storage.save_upload(_fake_upload(data), "meeting-unlimited", ".wav")

    assert dest.exists()
    assert dest.read_bytes() == data


def test_save_upload_enforces_configured_limit(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "storage_dir", str(tmp_path))
    monkeypatch.setattr(storage.settings, "max_upload_size_mb", 1)

    data = b"b" * (2 * 1024 * 1024)
    with pytest.raises(HTTPException) as exc_info:
        storage.save_upload(_fake_upload(data), "meeting-limited", ".wav")

    assert exc_info.value.status_code == 413
    assert "1 MB" in exc_info.value.detail
    # partial file must not be left behind on disk
    assert not (tmp_path / "uploads" / "meeting-limited.wav").exists()


class _TrackingReader:
    """Wraps BytesIO to record the size requested on each .read() call."""

    def __init__(self, data: bytes):
        self._buf = io.BytesIO(data)
        self.read_sizes: list[int] = []

    def read(self, size=-1):
        self.read_sizes.append(size)
        return self._buf.read(size)


def test_save_upload_streams_in_chunks_never_reads_whole_file_at_once(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "storage_dir", str(tmp_path))
    monkeypatch.setattr(storage.settings, "max_upload_size_mb", 0)

    data = b"c" * (5 * 1024 * 1024)
    reader = _TrackingReader(data)
    upload = SimpleNamespace(file=reader, filename="recording.wav")

    storage.save_upload(upload, "meeting-stream", ".wav")

    assert reader.read_sizes, "expected at least one chunked read"
    assert all(size == 1024 * 1024 for size in reader.read_sizes)


def test_save_upload_rejects_empty_file(tmp_path, monkeypatch):
    monkeypatch.setattr(storage.settings, "storage_dir", str(tmp_path))
    with pytest.raises(HTTPException) as exc_info:
        storage.save_upload(_fake_upload(b""), "meeting-empty", ".wav")
    assert exc_info.value.status_code == 400


def test_validate_upload_rejects_unsupported_extension():
    with pytest.raises(HTTPException) as exc_info:
        storage.validate_upload(_fake_upload(b"data", filename="virus.exe"))
    assert exc_info.value.status_code == 400


def test_sanitize_filename_strips_path_traversal():
    assert storage.sanitize_filename("../../etc/passwd") == "passwd"


def test_sanitize_filename_only_allows_safe_characters():
    result = storage.sanitize_filename("kayıt notu (1) [taslak].mp3")
    assert re.fullmatch(r"[A-Za-z0-9._-]+", result)


def test_sanitize_filename_handles_empty_name():
    assert storage.sanitize_filename("") == "dosya"
