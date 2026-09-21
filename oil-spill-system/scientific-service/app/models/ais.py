"""AIS and vessel attribution contract schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator

from .forward_drift import GeoPoint


class AisMessageOut(BaseModel):
    timestamp: datetime
    longitude: float
    latitude: float
    speedKnots: float
    courseDeg: float
    headingDeg: float
    interpolated: bool = False


class AisTrackOut(BaseModel):
    mmsi: int
    name: str
    vesselType: str
    imo: Optional[str] = None
    lengthM: Optional[float] = None
    beamM: Optional[float] = None
    draftM: Optional[float] = None
    messages: List[AisMessageOut] = []
    sourceState: str = "CONTROLLED"
    provider: Optional[str] = None
    dataset: Optional[str] = None


class AnomalyOut(BaseModel):
    kind: str
    timestamp: Optional[datetime] = None
    metric: Optional[Union[str, float]] = None
    detail: Optional[str] = None


class AisCandidateOut(BaseModel):
    mmsi: int
    name: str
    vesselType: str
    imo: Optional[str] = None
    track: Optional[AisTrackOut] = None
    messagesInWindow: int
    medianCadenceMin: float
    interpolationFraction: float
    coverageGaps: int
    minDistanceKm: float
    timeOfClosestApproach: Optional[datetime] = None
    closestPosition: Optional[Union[Dict[str, float], List[float]]] = None
    anomalies: List[AnomalyOut] = []
    reliability: Union[str, float]
    reliabilityNotes: List[str] = []


class AisQueryRequest(BaseModel):
    origin: GeoPoint
    timeStart: datetime
    timeEnd: datetime
    radiusKm: float = 50.0
    source: str = "CONTROLLED"
    seed: Optional[int] = None
    maxVessels: Optional[int] = None


class AisQueryResponse(BaseModel):
    status: str = "success"
    sourceState: str
    provider: str
    dataset: str
    references: Dict[str, Any] = {}
    vesselCount: int
    tracks: List[AisTrackOut]
    elapsedMs: int


class TimeRangeIn(BaseModel):
    earliest: datetime
    latest: datetime


class AisFilterRequest(BaseModel):
    origin: GeoPoint
    radiusKm: float
    tracks: List[AisTrackOut]
    timeRange: TimeRangeIn
    maxGapMin: Optional[float] = 30.0

    @field_validator("maxGapMin", mode="before")
    @classmethod
    def default_gap(cls, v: Any) -> float:
        return 30.0 if v is None else float(v)


class AisFilterResponse(BaseModel):
    status: str = "success"
    kept: int
    dropped: int
    stats: Dict[str, Any]
    candidates: List[AisCandidateOut]
    droppedVessels: List[Dict[str, Any]]


class ScoreBacktrackingIn(BaseModel):
    origin: Optional[GeoPoint] = None
    timeRange: Optional[TimeRangeIn] = None
    trajectories: List[Dict[str, Any]] = []


class ScoreEnvironmentIn(BaseModel):
    uCurrent: float = 0.0
    vCurrent: float = 0.0
    uWind: float = 0.0
    vWind: float = 0.0


class ScoreVesselsRequest(BaseModel):
    candidates: List[AisCandidateOut]
    origin: GeoPoint
    releaseTime: Optional[datetime] = None
    searchRadiusKm: float = 50.0
    weights: Optional[Dict[str, float]] = None
    backtracking: Optional[ScoreBacktrackingIn] = None
    environment: Optional[ScoreEnvironmentIn] = None


class ScoreVesselsResponse(BaseModel):
    status: str
    rankedVessels: List[Dict[str, Any]]
    ranking: Union[Dict[str, Any], List[Any]]
    conclusion: str
    weightsUsed: Dict[str, float]
    attributionModelVersion: str
    sourceState: str
    warnings: List[str]


class AttributionValidateRequest(BaseModel):
    writeArtifact: bool = False
    scenario: Optional[str] = None
    seed: Optional[int] = 26143


class AttributionValidateResponse(BaseModel):
    scenarios: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    writeArtifact: bool
    artifactPath: Optional[str] = None
    warnings: List[str] = []
