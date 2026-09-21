"""Backtracking contract schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field

from .forward_drift import CurrentForcing, GeoPoint, WindForcing


class SourceTimeRange(BaseModel):
    earliest: datetime
    latest: datetime
    preferred: Optional[datetime] = None
    nominal: Optional[datetime] = None
    uncertainty_minutes: float = 0.0


class ConfidenceMetrics(BaseModel):
    source_concentration: Union[str, float] = "LOW"
    environmental_quality: str = "LOW"
    trajectory_agreement: float = 0.0
    ensemble_stability: float = 0.0


class EnsembleSummary(BaseModel):
    member_count: int = 0
    converged_count: int = 0
    mean_endpoint_distance_km: float = 0.0
    std_endpoint_distance_km: float = 0.0


class QualityMetrics(BaseModel):
    total_particles: int = 0
    converged_particles: int = 0
    land_hits: int = 0
    domain_exits: int = 0
    invalid_particles: int = 0
    warnings: List[str] = []


class BacktrackRunMetadata(BaseModel):
    run_id: str
    simulation_id: Optional[str] = None
    model_version: str
    environment_source: str
    environment_dataset: str
    ensemble_size: int
    particles_per_member: int
    duration_hours: float
    timestep_seconds: int
    seed: Optional[int] = None
    reproducibility_digest: str = ""
    started_at: datetime
    completed_at: datetime
    elapsed_ms: int


class BacktrackRequest(BaseModel):
    origin: GeoPoint
    time: datetime
    duration_hours: float = Field(default=6.0, gt=0.0)
    ensemble_size: int = Field(default=50, gt=0)
    particles_per_member: int = Field(default=100, gt=0)
    seed: Optional[int] = None
    environmentSource: str = "CONTROLLED"
    currents: Optional[CurrentForcing] = None
    wind: Optional[WindForcing] = None
    polygon: Optional[List[List[float]]] = None
    simulation_id: Optional[str] = None


class BacktrackResponse(BaseModel):
    run_id: str
    status: str
    source_region: Optional[Dict[str, Any]] = None
    source_contours: Optional[List[Dict[str, Any]]] = None
    origin_estimate: Optional[Dict[str, float]] = None
    origin_time_range: Optional[SourceTimeRange] = None
    uncertainty_km: float = 0.0
    confidence: Optional[ConfidenceMetrics] = None
    trajectories: List[Dict[str, Any]] = []
    ensemble_summary: Optional[EnsembleSummary] = None
    quality: Optional[QualityMetrics] = None
    backtrackRun: Optional[BacktrackRunMetadata] = None
    warnings: List[str] = []
