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


def transcribe_audio(wav_path: Path, language: str | None = None) -> TranscriptionResult:
    model = _get_model()
    lang = language or settings.whisper_language
    # "auto" lets faster-whisper detect the language instead of forcing Turkish.
    detect_kwargs = {} if lang == "auto" else {"language": lang}

    segments_iter, info = model.transcribe(
        str(wav_path),
        vad_filter=True,
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
