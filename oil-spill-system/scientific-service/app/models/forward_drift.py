"""Forward-drift contract schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class GeoPoint(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)


class CurrentForcing(BaseModel):
    u: float = 0.0
    v: float = 0.0


class WindForcing(BaseModel):
    u: float = 0.0
    v: float = 0.0


class Particle(BaseModel):
    lon: float
    lat: float
    z: float = 0.0
    mass_kg: float = 0.0


class Extent(BaseModel):
    type: str = "Polygon"
    coordinates: List[Any] = []


class MassBalance(BaseModel):
    evaporated_kg: float = 0.0
    dispersed_kg: float = 0.0
    remaining_kg: float = 0.0


class DriftRunMetadata(BaseModel):
    run_id: str
    simulation_id: Optional[str] = None
    oil_type: str
    particles_used: int
    timestep_seconds: int
    duration_hours: float
    environment_source: str
    environment_dataset: str
    model_version: str
    reproducibility_digest: str
    started_at: datetime
    completed_at: datetime
    elapsed_ms: int


class ForwardDriftRequest(BaseModel):
    origin: GeoPoint
    time: datetime
    duration_hours: float = Field(..., gt=0.0)
    particleCount: int = Field(..., gt=0)
    oilType: str = "GENERIC BUNKER C"
    currents: Optional[CurrentForcing] = None
    wind: Optional[WindForcing] = None
    environmentSource: str = "CONTROLLED"


class ForwardDriftResponse(BaseModel):
    particles: List[Particle]
    extent: Extent
    massBalance: MassBalance
    driftRun: DriftRunMetadata


class PreviewResponse(BaseModel):
    oil_types: List[str]
    default_oil_type: str
    environment_availability: Dict[str, Any]
    model_version: str
