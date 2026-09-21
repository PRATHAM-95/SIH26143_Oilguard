"""SAR observation contract schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from ..sar.scenes import _SOURCES


class SarPreviewResponse(BaseModel):
    availability: Dict[str, Any]
    model_version: str


class SarCatalogResponse(BaseModel):
    status: str
    reason: Optional[str] = None
    searched_at: Optional[str] = None
    aoi: Optional[Dict[str, Any]] = None
    time_range: Optional[Dict[str, Any]] = None
    product_count: int = 0
    products: List[Dict[str, Any]] = []
    technical: Optional[Dict[str, Any]] = None


class SarDetectRequest(BaseModel):
    source: str = "LOCAL_FIXTURE"
    detector: str = "CLASSICAL"
    max_candidates: int = 6
    scene_id: Optional[str] = None
    aoi: Optional[Dict[str, Any]] = None

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        key = (v or "LOCAL_FIXTURE").strip().upper()
        if key not in _SOURCES:
            raise ValueError(f"Unknown SAR source '{v}'. Valid: {sorted(_SOURCES)}")
        return key


class SarDetectResponse(BaseModel):
    observation_id: str
    status: str
    source_state: str
    source: str
    provider_dataset: str
    acquisition_time: Optional[datetime] = None
    satellites: List[str] = []
    polarization: Optional[str] = None
    scene_id: Optional[str] = None
    scene_footprint: Optional[Dict[str, Any]] = None
    detector: str
    detector_version: str
    preprocess_steps: List[str] = []
    candidates: List[Dict[str, Any]] = []
    confidence: Optional[float] = None
    slick_area_km2: Optional[float] = None
    age_estimate: Optional[Any] = None
    age_available: bool = False
    warnings: List[str] = []
    errors: List[str] = []
