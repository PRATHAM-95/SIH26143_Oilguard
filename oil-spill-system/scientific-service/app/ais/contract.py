"""AIS data contracts shared across the attribution pipeline.

Provenance mirrors the environment provider layer (environment/providers.py):
every AIS trial is stamped with an explicit source state — ``REAL`` (genuine
provider data), ``CONTROLLED`` (deterministic simulated traffic, clearly
labelled, never presented as real), ``FIXTURE`` (test fixture), or
``UNAVAILABLE`` (a real provider could not be consulted).

The frontend and reports surface this state verbatim so a CONTROLLED run is
never mistaken for REAL AIS.
"""

from __future__ import annotations

import dataclasses
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class AisSourceState(str, Enum):
    REAL = "REAL"
    CONTROLLED = "CONTROLLED"
    FIXTURE = "FIXTURE"
    UNAVAILABLE = "UNAVAILABLE"


class AisProviderError(RuntimeError):
    """Raised when an AIS provider cannot satisfy a query honestly.

    Subclasses are used by the real-data seams (GFW, Marine Cadastre,
    aisstream.io) so the API can report exactly why a provider is
    UNAVAILABLE rather than silently degrading.
    """


class AisValidationError(ValueError):
    """Raised for semantically invalid attribution inputs."""


@dataclass(frozen=True)
class AisMessage:
    """A single decoded AIS position report."""

    timestamp: datetime
    longitude: float
    latitude: float
    speed_knots: float
    course_deg: float
    heading_deg: float
    interpolated: bool = False


@dataclass
class AisTrack:
    """Per-vessel AIS message series (already chronologically ordered)."""

    mmsi: str
    name: str
    vessel_type: str
    imo: str | None = None
    length_m: float | None = None
    beam_m: float | None = None
    draft_m: float | None = None
    messages: list[AisMessage] = field(default_factory=list)
    source_state: AisSourceState = AisSourceState.CONTROLLED
    provider: str = "CONTROLLED"
    dataset: str = "controlled-v1"
    generator_seed: int | None = None


@dataclass(frozen=True)
class AnomalySignal:
    """A rule-based anomaly observation derived from a track (frost §10.4)."""

    kind: str  # 'speed_drop' | 'loiter' | 'heading_deviation' | 'reporting_gap'
    timestamp: datetime
    metric: float
    detail: str


@dataclass
class AisCandidate:
    """A vessel that survived querying + filtering, ready for scoring.

    ``data_quality`` is deliberately carried separately from the composite
    score: AIS reliability is reported to the investigator as its own evidence
    block and never folded into the five frozen scoring factors.
    """

    mmsi: str
    name: str
    vessel_type: str
    track: AisTrack
    imo: str | None = None
    messages_in_window: int = 0
    median_cadence_min: float = 0.0
    interpolation_fraction: float = 0.0
    coverage_gaps: int = 0
    min_distance_km: float | None = None
    time_of_closest_approach: datetime | None = None
    closest_position: dict | None = None
    anomalies: list[AnomalySignal] = field(default_factory=list)
    reliability: str = "LOW"  # HIGH | MEDIUM | LOW
    reliability_notes: list[str] = field(default_factory=list)
    drop_reasons: list[str] = field(default_factory=list)


class AisProvider(ABC):
    """Marker interface implemented by every AIS source.

    Subclasses MUST be honest about what they can deliver:

    * Layer A (``ControlledAisProvider``) — deterministic, seeded simulated
      traffic. Always labelled CONTROLLED.
    * Layer B (``GfwAisProvider``, ``MarineCadastreProvider``,
      ``AisStreamProvider``) — real-data seams. Each raises
      :class:`AisProviderError` with an explicit reason when the real feed is
      not available for the requested window/region, and NEVER returns
      fabricated data to substitute for a real feed.
    """

    source: str = "UNKNOWN"
    state: AisSourceState = AisSourceState.UNAVAILABLE
    dataset: str = "unknown"
    is_available: bool = False

    @abstractmethod
    def query(
        self,
        *,
        center_lon: float,
        center_lat: float,
        time_start: datetime,
        time_end: datetime,
        radius_km: float,
        seed: int | None = None,
        max_vessels: int | None = None,
    ) -> list[AisTrack]:
        raise NotImplementedError