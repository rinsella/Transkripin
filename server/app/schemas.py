from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


OutputMode = Literal["plain", "paragraph", "timestamped"]
ModelSize = Literal["tiny", "base", "small", "medium", "large-v3"]


class Segment(BaseModel):
    start: float
    end: float
    text: str


class TranscribeResponse(BaseModel):
    success: bool = True
    text: str
    segments: List[Segment] = Field(default_factory=list)
    language: str
    duration: float
    model: str


class HealthResponse(BaseModel):
    status: str = "ok"
    engine: str = "faster-whisper"
    model_loaded: Optional[str] = None
    device: str
    compute_type: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None
