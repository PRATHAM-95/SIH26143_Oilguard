"""Normalized SAR observation contract.

The detection pipeline must be agnostic to *where* a scene came from
(real Sentinel-1 via Copernicus Data Space, a cached real scene, a local
fixture, or a deterministic synthetic scene). This module defines the
normalized representation every source stage produces and that the
detector + characterizer consume.

The top-level artifact is an :class:`ObservationResult`, which is the
stable output surfaced to Spring Boot and later stages (backtracking, AIS).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional


class ProvenanceState(str, Enum):
    """Explicit source state for a SAR observation (never kept ambiguous)."""

    REAL_SENTINEL1 = "REAL_SENTINEL1"
    CACHED_SENTINEL1 = "CACHED_SENTINEL1"
    LOCAL_FIXTURE = "LOCAL_FIXTURE"
    SYNTHETIC = "SYNTHETIC"
    UNAVAILABLE = "UNAVAILABLE"


class CandidateClass(str, Enum):
    """Detector judgement for a candidate dark region.

    The classical dark-spot detector cannot *prove* oil: dark SAR features
    also arise from look-alikes (low wind, rain cells, biogenic slicks). We
    therefore report a class plus a confidence rather than a false certainty.
    """

    OIL_CANDIDATE = "OIL_CANDIDATE"
    UNCERTAIN = "UNCERTAIN"
    LOOK_ALIKE = "LOOK_ALIKE"
    REJECTED = "REJECTED"


class ProcessingStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    UNAVAILABLE = "unavailable"
    FAILED = "failed"


@dataclass(frozen=True)
class GeoTransform:
    """Simple north-up affine mapping pixel -> lon/lat.

    Uses an equirectangular local projection (pixel_to_metres) for the
    geometric measurements at the small scene scales involved; metres-per-
    degree accounts for cos(latitude) so measurements are geographically
    meaningful rather than raw pixel counts.
    """

    west_lon: float
    north_lat: float
    px_deg_lon: float  # degrees of longitude per pixel (east-positive)
    px_deg_lat: float  # degrees of latitude per pixel (south-positive)

    def pixel_to_lonlats(
        self, rows: List[int], cols: List[int]
    ) -> List[tuple[float, float]]:
        """Convert pixel (row, col) coordinates to (lon, lat) tuples."""
        out = []
        for r, c in zip(rows, cols):
            lon = self.west_lon + c * self.px_deg_lon
            lat = self.north_lat - r * self.px_deg_lat
            out.append((lon, lat))
        return out

    def pixel_to_metres(self, pixel_size: float, mean_lat: float) -> float:
        """Approximate metres per pixel at a reference latitude."""
        from math import cos, radians

        lon_m_per_deg = 111320.0
        lat_m_per_deg = 110574.0
        # local equirectangular: average of the lon/lat metre scales.
        return pixel_size * (lon_m_per_deg * cos(radians(mean_lat)) + lat_m_per_deg) / 2.0


@dataclass(frozen=True)
class SarScene:
    """A single processed SAR scene ready for detection.

    ``amplitude_db`` is a 2-D float array (rows x cols) of VV (or selected
    polarization) backscatter in decibels; ``land_mask`` is a boolean array
    True where land/wet-nodata regions should be excluded from detection.
    """

    scene_id: str
    acquisition_time: datetime
    satellites: List[str]
    polarization: str
    geotransform: GeoTransform
    amplitude_db: object  # numpy 2-D float array
    land_mask: object  # numpy 2-D bool array, matched shape
    source: str
    source_state: ProvenanceState
    provider_dataset: str
    processing_log: List[str] = field(default_factory=list)
    # Optional per-pixel incidence angle (degrees), 2-D array matched to
    # amplitude_db. Only present for real GRD scenes that carry the metadata;
    # the detector uses it purely to qualify confidence, never to invent data.
    incidence_deg: object = None

    @property
    def shape(self) -> tuple[int, int]:
        return self.amplitude_db.shape

    def record(self, msg: str) -> None:
        """Append a step to the reproducible processing log."""
        self.processing_log.append(msg)


@dataclass(frozen=True)
class SlickCandidate:
    """A geometric oil-slick candidate extracted from the detection mask."""

    candidate_id: str
    classification: CandidateClass
    confidence: float  # 0..1 — NOT perfect-detection evidence
    centroid: tuple[float, float]  # (lon, lat)
    polygon: List[tuple[float, float]]  # GeoJSON ring, first == last
    bbox: dict  # {north, south, east, west} in degrees
    area_km2: float
    perimeter_km: float
    length_km: float
    width_km: float
    aspect_ratio: float
    orientation_deg: float
    shape_factor: float  # compactness = area / perimeter^2
    pixel_area: int
    # Hardening metric (Step 08): local backscatter contrast of the dark region
    # against the measured open-sea reference, in dB. Strong, stable contrast is
    # the primary physical signal that discriminates a real oil slick from a
    # marginal/ambiguous dark region; weak contrast downgrades confidence.
    contrast_db: Optional[float] = None
    # Optional mean incidence angle (degrees) over the candidate, when the scene
    # carries per-pixel incidence angle metadata (real GRD). Low incidence angles
    # are associated with more look-alikes, so it is used only to weight
    # confidence / provide an honest caveat. None when not available.
    incidence_deg: Optional[float] = None
    look_alike_hints: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class ObservationResult:
    """Stable observation result that later stages (backtracking, AIS) consume.

    This carries both observed-evidence metadata (which scene, which
    acquisition) and the detector's inferred candidates (model output). The
    frontend must present the two distinctly: the scene is evidence, the
    candidates are detector output.
    """

    observation_id: str
    status: ProcessingStatus
    source_state: ProvenanceState
    source: str
    provider_dataset: str
    acquisition_time: Optional[datetime]
    satellites: List[str]
    polarization: str
    scene_id: str
    scene_footprint: Optional[object]  # GeoJSON Polygon (footprint) or None
    detector: str
    detector_version: str
    preprocess_steps: List[str] = field(default_factory=list)
    candidates: List[SlickCandidate] = field(default_factory=list)
    confidence: Optional[float] = None  # overall obs confidence if any candidate
    slick_area_km2: Optional[float] = None
    age_estimate: Optional[str] = None  # None => not estimated
    age_available: bool = False
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
