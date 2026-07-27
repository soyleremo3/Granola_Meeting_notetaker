"""Local Turkish speech-to-text using faster-whisper. Runs fully offline."""

import threading
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

_model = None
_model_lock = threading.Lock()


@dataclass
class TranscriptSegmentResult:
    index: int
    start_time: float
    end_time: float
    text: str


@dataclass
class TranscriptionResult:
    segments: list[TranscriptSegmentResult]
    language: str
    duration: float


class NoSpeechDetectedError(RuntimeError):
    """Raised when faster-whisper finds no usable speech, even after retrying without VAD."""


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from faster_whisper import WhisperModel

                _model = WhisperModel(
                    settings.whisper_model,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                )
    return _model


def _transcribe_once(model, wav_path: Path, lang: str, vad_filter: bool) -> TranscriptionResult:
    # "auto" lets faster-whisper detect the language instead of forcing Turkish.
    detect_kwargs = {} if lang == "auto" else {"language": lang}

    segments_iter, info = model.transcribe(
        str(wav_path),
        vad_filter=vad_filter,
        beam_size=5,
        **detect_kwargs,
    )

    segments: list[TranscriptSegmentResult] = []
    for idx, seg in enumerate(segments_iter):
        text = seg.text.strip()
        if not text:
            continue
        segments.append(
            TranscriptSegmentResult(
                index=idx,
                start_time=round(seg.start, 2),
                end_time=round(seg.end, 2),
                text=text,
            )
        )

    return TranscriptionResult(
        segments=segments,
        language=info.language or lang,
        duration=info.duration or 0.0,
    )


def transcribe_audio(wav_path: Path, language: str | None = None) -> TranscriptionResult:
    """Transcribe with VAD first; if VAD strips all speech, retry once without it.

    Raises NoSpeechDetectedError (clear Turkish message) if both attempts yield no segments,
    so callers never persist or analyze an empty transcript silently.
    """
    model = _get_model()
    lang = language or settings.whisper_language

    result = _transcribe_once(model, wav_path, lang, vad_filter=True)
    if not result.segments:
        result = _transcribe_once(model, wav_path, lang, vad_filter=False)

    if not result.segments:
        raise NoSpeechDetectedError(
            "Ses dosyasında konuşma algılanamadı. Dosyanın sessiz olmadığından ve doğru "
            "kaydedildiğinden emin olup tekrar deneyin."
        )

    return result
