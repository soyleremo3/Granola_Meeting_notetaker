from pathlib import Path

import pytest

from app.services import transcription
from app.services.transcription import NoSpeechDetectedError, transcribe_audio


class _FakeInfo:
    def __init__(self, language="tr", duration=5.0):
        self.language = language
        self.duration = duration


class _FakeSegment:
    def __init__(self, start, end, text):
        self.start = start
        self.end = end
        self.text = text


class _FakeModel:
    """Returns empty segments when vad_filter=True, real segments when False."""

    def __init__(self, empty_with_vad=True, always_empty=False):
        self.empty_with_vad = empty_with_vad
        self.always_empty = always_empty
        self.calls = []

    def transcribe(self, path, vad_filter, beam_size, **kwargs):
        self.calls.append(vad_filter)
        if self.always_empty:
            return iter([]), _FakeInfo()
        if vad_filter and self.empty_with_vad:
            return iter([]), _FakeInfo()
        return iter([_FakeSegment(0.0, 2.0, "Merhaba dünya")]), _FakeInfo()


def test_transcribe_retries_without_vad_when_vad_strips_everything(monkeypatch):
    fake_model = _FakeModel(empty_with_vad=True)
    monkeypatch.setattr(transcription, "_get_model", lambda: fake_model)

    result = transcribe_audio(Path("fake.wav"), language="tr")

    assert fake_model.calls == [True, False]
    assert len(result.segments) == 1
    assert result.segments[0].text == "Merhaba dünya"


def test_transcribe_raises_clear_turkish_error_when_both_attempts_empty(monkeypatch):
    fake_model = _FakeModel(always_empty=True)
    monkeypatch.setattr(transcription, "_get_model", lambda: fake_model)

    with pytest.raises(NoSpeechDetectedError, match="konuşma algılanamadı"):
        transcribe_audio(Path("fake.wav"), language="tr")

    assert fake_model.calls == [True, False]


def test_transcribe_skips_retry_when_vad_succeeds(monkeypatch):
    fake_model = _FakeModel(empty_with_vad=False)
    monkeypatch.setattr(transcription, "_get_model", lambda: fake_model)

    result = transcribe_audio(Path("fake.wav"), language="tr")

    assert fake_model.calls == [True]
    assert len(result.segments) == 1
