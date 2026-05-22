"""Helpers untuk validasi dan konversi audio menggunakan ffmpeg."""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
from pathlib import Path
from typing import Tuple

log = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".webm", ".ogg", ".flac", ".mp4"}
ALLOWED_MIME_PREFIXES = ("audio/", "video/webm", "video/mp4")


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def validate_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Format file tidak didukung ({ext or 'tanpa ekstensi'}). "
            f"Gunakan salah satu: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    return ext


def validate_mime(content_type: str | None) -> None:
    if not content_type:
        return
    if not any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise ValueError(f"MIME type tidak didukung: {content_type}")


async def probe_duration_seconds(path: Path) -> float:
    """Gunakan ffprobe untuk mendapatkan durasi audio dalam detik."""
    proc = await asyncio.create_subprocess_exec(
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe gagal: {err.decode(errors='ignore').strip()}")
    try:
        return float(out.decode().strip())
    except ValueError:
        return 0.0


async def convert_to_wav_mono_16k(src: Path, dst: Path) -> Path:
    """Convert sembarang format audio ke WAV mono 16kHz PCM s16le."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        "-acodec",
        "pcm_s16le",
        str(dst),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            "ffmpeg gagal mengkonversi audio: "
            + err.decode(errors="ignore").strip()
        )
    return dst


def safe_unlink(*paths: Path) -> None:
    for p in paths:
        try:
            if p and p.exists():
                p.unlink()
        except OSError as e:  # pragma: no cover
            log.warning("Gagal menghapus file sementara %s: %s", p, e)
