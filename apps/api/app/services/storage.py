import re
import subprocess
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import settings

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".webm", ".ogg"}
_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")

NO_AUDIO_STREAM_MESSAGE = (
    "Bu kayıtta ses kanalı bulunamadı. Chrome Sekmesi'ni seçip 'Sekme sesini paylaş' seçeneğini "
    "etkinleştirin veya Yalnızca Mikrofon kaydını kullanın."
)


class UnsupportedFileError(Exception):
    pass


class NoAudioStreamError(Exception):
    """Raised when the source media (e.g. a video-only screen recording) has no audio stream.

    Transcription is impossible without audio, so the pipeline must stop here with a friendly
    message rather than let ffmpeg fail conversion with a raw "does not contain any stream" error.
    """


def sanitize_filename(filename: str) -> str:
    name = Path(filename).name  # strips any path traversal component
    name = _SAFE_NAME_RE.sub("_", name)
    return name[-150:] or "dosya"


def validate_upload(file: UploadFile) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Dosya adı bulunamadı.")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya türü: {ext or 'bilinmiyor'}. Desteklenen türler: {allowed}",
        )
    return ext


def save_upload(file: UploadFile, meeting_id: str, ext: str) -> Path:
    """Streams the upload to disk in 1MB chunks — the full file is never held in memory.

    `max_upload_size_mb == 0` means no application-level size limit (still streamed,
    bounded only by available disk space).
    """
    safe_name = f"{meeting_id}{ext}"
    dest = settings.uploads_path / safe_name
    max_bytes = settings.max_upload_size_mb * 1024 * 1024 if settings.max_upload_size_mb > 0 else None

    written = 0
    with dest.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            written += len(chunk)
            if max_bytes is not None and written > max_bytes:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"Dosya çok büyük. Maksimum boyut: {settings.max_upload_size_mb} MB.",
                )
            out.write(chunk)

    if written == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Yüklenen dosya boş.")

    return dest


def save_recording_bytes(data: bytes, meeting_id: str, ext: str = ".webm") -> Path:
    max_bytes = settings.max_upload_size_mb * 1024 * 1024 if settings.max_upload_size_mb > 0 else None
    if max_bytes is not None and len(data) > max_bytes:
        raise HTTPException(
            status_code=413, detail=f"Kayıt çok büyük. Maksimum boyut: {settings.max_upload_size_mb} MB."
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Kayıt verisi boş.")
    dest = settings.recordings_path / f"{meeting_id}{ext}"
    dest.write_bytes(data)
    return dest


def has_audio_stream(path: Path) -> bool:
    """True if ffprobe reports at least one audio stream in the given media file."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=index",
        "-of",
        "csv=p=0",
        str(path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg bulunamadı. Lütfen FFmpeg'i kurun ve PATH içine ekleyin.") from exc
    return bool(result.stdout.strip())


def convert_to_wav(source_path: Path, meeting_id: str) -> Path:
    """Convert any supported media file to 16kHz mono WAV for transcription.

    Raises NoAudioStreamError up front (before invoking ffmpeg) when the source has no audio
    stream at all, e.g. a screen recording captured without "share tab audio" enabled.
    """
    if not has_audio_stream(source_path):
        raise NoAudioStreamError(NO_AUDIO_STREAM_MESSAGE)

    dest = settings.storage_path / "processed" / f"{meeting_id}.wav"
    dest.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-vn",
        str(dest),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg bulunamadı. Lütfen FFmpeg'i kurun ve PATH içine ekleyin.") from exc

    if result.returncode != 0:
        raise RuntimeError(f"Ses dönüştürme başarısız oldu: {result.stderr[-500:]}")

    return dest


def probe_duration_seconds(path: Path) -> float | None:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return float(result.stdout.strip())
    except Exception:
        return None


def delete_meeting_files(meeting_id: str) -> None:
    for base_dir in (settings.uploads_path, settings.recordings_path, settings.storage_path / "processed"):
        if not base_dir.exists():
            continue
        for f in base_dir.glob(f"{meeting_id}.*"):
            f.unlink(missing_ok=True)
