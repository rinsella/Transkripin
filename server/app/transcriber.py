"""Wrapper di sekitar faster-whisper dengan caching model in-process."""
from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from faster_whisper import WhisperModel

from .schemas import Segment

log = logging.getLogger(__name__)


@dataclass
class TranscriptionResult:
    text: str
    segments: List[Segment]
    language: str
    duration: float
    model: str


class Transcriber:
    """Thread-safe lazy-loader untuk model faster-whisper."""

    def __init__(
        self,
        default_model: str = "base",
        device: str = "cpu",
        compute_type: str = "int8",
        download_root: Optional[str] = None,
    ) -> None:
        self.default_model = default_model
        self.device = device
        self.compute_type = compute_type
        self.download_root = download_root
        self._models: Dict[str, WhisperModel] = {}
        self._lock = threading.Lock()

    def get_model(self, size: str) -> WhisperModel:
        with self._lock:
            if size in self._models:
                return self._models[size]
            log.info(
                "Memuat model faster-whisper '%s' (device=%s, compute_type=%s)…",
                size,
                self.device,
                self.compute_type,
            )
            kwargs = {
                "device": self.device,
                "compute_type": self.compute_type,
            }
            if self.download_root:
                kwargs["download_root"] = self.download_root
            model = WhisperModel(size, **kwargs)
            self._models[size] = model
            log.info("Model '%s' siap.", size)
            return model

    def warm_up(self) -> None:
        try:
            self.get_model(self.default_model)
        except Exception as e:  # pragma: no cover - non-fatal
            log.warning("Warm-up model '%s' gagal: %s", self.default_model, e)

    def transcribe(
        self,
        wav_path: Path,
        model_size: str,
        language: Optional[str] = None,
        return_timestamps: bool = True,
    ) -> TranscriptionResult:
        model = self.get_model(model_size)

        whisper_language = None if not language or language == "auto" else language

        segments_iter, info = model.transcribe(
            str(wav_path),
            language=whisper_language,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )

        segments: List[Segment] = []
        text_parts: List[str] = []
        for seg in segments_iter:
            text_parts.append(seg.text)
            if return_timestamps:
                segments.append(
                    Segment(
                        start=float(seg.start or 0.0),
                        end=float(seg.end or 0.0),
                        text=seg.text.strip(),
                    )
                )

        full_text = " ".join(t.strip() for t in text_parts).strip()
        return TranscriptionResult(
            text=full_text,
            segments=segments,
            language=info.language or whisper_language or "unknown",
            duration=float(getattr(info, "duration", 0.0) or 0.0),
            model=model_size,
        )


def format_output(result: TranscriptionResult, mode: str) -> str:
    """Format teks transkrip sesuai pilihan output_mode."""
    if mode == "timestamped" and result.segments:
        lines = []
        for s in result.segments:
            lines.append(f"[{_fmt_ts(s.start)} → {_fmt_ts(s.end)}] {s.text}")
        return "\n".join(lines)
    if mode == "paragraph":
        cleaned = " ".join(result.text.split())
        sentences = _split_sentences(cleaned)
        paragraphs = []
        for i in range(0, len(sentences), 4):
            paragraphs.append(" ".join(sentences[i : i + 4]))
        return "\n\n".join(paragraphs)
    return result.text


def _split_sentences(text: str) -> List[str]:
    import re

    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p for p in parts if p]


def _fmt_ts(seconds: float) -> str:
    seconds = max(0, int(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"
