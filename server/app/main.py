"""Transkripin FastAPI backend — server-side transcription via faster-whisper."""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import aiofiles
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Muat file .env (jika ada) sebelum membaca environment.
load_dotenv()

from .audio_utils import (
    convert_to_wav_mono_16k,
    ffmpeg_available,
    probe_duration_seconds,
    safe_unlink,
    validate_extension,
    validate_mime,
)
from .schemas import (
    ErrorResponse,
    HealthResponse,
    ModelSize,
    TranscribeResponse,
)
from .transcriber import Transcriber, format_output

# ── Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
log = logging.getLogger("transkripin")

# ── Config dari ENV ────────────────────────────────────────────────
MODEL_SIZE = os.environ.get("MODEL_SIZE", "base")
DEVICE = os.environ.get("DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("COMPUTE_TYPE", "int8")
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "100"))
MAX_AUDIO_DURATION_MINUTES = int(os.environ.get("MAX_AUDIO_DURATION_MINUTES", "60"))
TRANSCRIBE_TIMEOUT_SECONDS = int(os.environ.get("TRANSCRIBE_TIMEOUT_SECONDS", "1800"))
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
CORS_ORIGIN_REGEX = os.environ.get("CORS_ORIGIN_REGEX") or None
MODEL_CACHE_DIR = os.environ.get("MODEL_CACHE_DIR") or None
TMP_DIR = Path(os.environ.get("TMP_DIR") or tempfile.gettempdir()) / "transkripin"
TMP_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_MODEL_SIZES = {"tiny", "base", "small", "medium", "large-v3"}

transcriber = Transcriber(
    default_model=MODEL_SIZE,
    device=DEVICE,
    compute_type=COMPUTE_TYPE,
    download_root=MODEL_CACHE_DIR,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(
        "Transkripin backend siap. model=%s device=%s compute_type=%s max_upload=%dMB",
        MODEL_SIZE,
        DEVICE,
        COMPUTE_TYPE,
        MAX_UPLOAD_MB,
    )
    if not ffmpeg_available():
        log.warning("ffmpeg/ffprobe TIDAK ditemukan di PATH — endpoint /transcribe akan gagal.")
    # Preload model di background agar request pertama lebih cepat.
    asyncio.get_event_loop().run_in_executor(None, transcriber.warm_up)
    yield


app = FastAPI(
    title="Transkripin Backend",
    description="Server-side audio transcription menggunakan faster-whisper.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ── Endpoints ─────────────────────────────────────────────────
@app.get("/")
async def root() -> dict:
    return {
        "name": "Transkripin Backend",
        "version": app.version,
        "engine": "faster-whisper",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        engine="faster-whisper",
        model_loaded=MODEL_SIZE,
        device=DEVICE,
        compute_type=COMPUTE_TYPE,
    )


@app.post(
    "/transcribe",
    response_model=TranscribeResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def transcribe_endpoint(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    model_size: str = Form("base"),
    output_mode: str = Form("plain"),
) -> JSONResponse:
    if not ffmpeg_available():
        raise HTTPException(
            status_code=500,
            detail="ffmpeg tidak tersedia di server. Install ffmpeg terlebih dahulu.",
        )

    if model_size not in ALLOWED_MODEL_SIZES:
        raise HTTPException(
            status_code=400,
            detail=f"model_size tidak valid. Gunakan salah satu: {sorted(ALLOWED_MODEL_SIZES)}",
        )
    if output_mode not in {"plain", "paragraph", "timestamped"}:
        raise HTTPException(status_code=400, detail="output_mode tidak valid.")

    try:
        ext = validate_extension(file.filename or "")
        validate_mime(file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    job_id = uuid.uuid4().hex
    src_path = TMP_DIR / f"{job_id}{ext}"
    wav_path = TMP_DIR / f"{job_id}.wav"

    # ── Simpan upload secara streaming dengan batas ukuran ───────
    written = 0
    try:
        async with aiofiles.open(src_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    safe_unlink(src_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File terlalu besar (>{MAX_UPLOAD_MB} MB).",
                    )
                await out.write(chunk)
        await file.close()

        # ── Cek durasi ───────────────────────────────────────────
        try:
            duration_s = await probe_duration_seconds(src_path)
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))

        max_seconds = MAX_AUDIO_DURATION_MINUTES * 60
        if duration_s and duration_s > max_seconds:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Durasi audio {duration_s/60:.1f} menit melebihi batas "
                    f"{MAX_AUDIO_DURATION_MINUTES} menit."
                ),
            )

        # ── Convert ke WAV 16k mono ──────────────────────────────
        await convert_to_wav_mono_16k(src_path, wav_path)

        # ── Jalankan transkripsi di threadpool dengan timeout ───
        log.info(
            "Transkripsi %s (%.1fs) mulai. model=%s lang=%s",
            file.filename,
            duration_s,
            model_size,
            language or "auto",
        )

        try:
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    transcriber.transcribe,
                    wav_path,
                    model_size,
                    language,
                    True,
                ),
                timeout=TRANSCRIBE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail=f"Transkripsi melewati timeout ({TRANSCRIBE_TIMEOUT_SECONDS}s).",
            )

        formatted_text = format_output(result, output_mode)
        response = TranscribeResponse(
            success=True,
            text=formatted_text,
            segments=result.segments,
            language=result.language,
            duration=result.duration or duration_s,
            model=result.model,
        )
        log.info(
            "Transkripsi %s selesai. chars=%d segments=%d",
            file.filename,
            len(formatted_text),
            len(result.segments),
        )
        return JSONResponse(response.model_dump())

    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        log.exception("Transkripsi gagal")
        raise HTTPException(status_code=500, detail=f"Transkripsi gagal: {e}")
    finally:
        safe_unlink(src_path, wav_path)


@app.post("/cleanup")
async def cleanup() -> dict:
    """Hapus semua sisa file sementara di TMP_DIR."""
    removed = 0
    for p in TMP_DIR.glob("*"):
        try:
            if p.is_file():
                p.unlink()
                removed += 1
        except OSError:
            pass
    return {"success": True, "removed": removed}
