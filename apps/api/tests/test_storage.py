from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import storage
from app.services.storage import NO_AUDIO_STREAM_MESSAGE, NoAudioStreamError


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
