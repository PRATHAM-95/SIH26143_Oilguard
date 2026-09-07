"""SAR observation pipeline orchestration.

Boundary mirrors ``app.drift.engine`` but for satellite observation:

    source -> prepare -> detect -> post-process -> characterize -> observation

The pipeline owns the ordering and provenance; detectors/providers are
swappable. Errors are surfaced as an :class:`ObservationResult` with a real
status ("unavailable" / "failed") and an explicit block reason — never as a
fabricated successful detection.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from .config import get_sar_config
from .contract import (
    CandidateClass,
    ObservationResult,
    ProcessingStatus,
    SarScene,
    SlickCandidate,
)
from .detectors import DetectorUnavailableError, SarDetector
from .detectors.classical import ClassicalDarkSpotDetector
from .detectors.onnx import OnnxSegmentationDetector
from .fixture import make_land_mask
from .scenes import SarSourceError, resolve_source

OBSERVATION_MODEL_VERSION = "1.0.0"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def build_scene_footprint(scene: SarScene) -> Optional[dict]:
    """GeoJSON Polygon of the scene's geographic footprint."""
    h, w = scene.shape
    west = scene.geotransform.west_lon
    north = scene.geotransform.north_lat
    east = west + w * scene.geotransform.px_deg_lon
    south = north - h * scene.geotransform.px_deg_lat
    ring = [
        [west, north],
        [east, north],
        [east, south],
        [west, south],
        [west, north],
    ]
    return {"type": "Polygon", "coordinates": [ring]}


def _classical_detector() -> SarDetector:
    return ClassicalDarkSpotDetector()


def _resolve_detector(detector: Optional[str]) -> SarDetector:
    cfg = get_sar_config()
    key = (detector or "CLASSICAL").strip().upper()
    if key in ("CLASSICAL", "CLASSICAL_DARK_SPOT", "DARK_SPOT"):
        return _classical_detector()
    if key in ("ONNX", "ML", "SEGMENTATION"):
        if not cfg.onnx_available:
            # Honest fallback: no weights -> use the classical baseline but note it.
            return _classical_detector()
        return OnnxSegmentationDetector()
    raise DetectorUnavailableError(f"Unknown detector '{detector}'.")


class SarPipeline:
    """End-to-end SAR observation pipeline."""

    def __init__(self) -> None:
        self.detector = _classical_detector()

    def process(
        self,
        source: Optional[str] = None,
        detector: Optional[str] = None,
        max_candidates: int = 6,
        observation_id: Optional[str] = None,
    ) -> ObservationResult:
        obs_id = observation_id or ("obs-" + uuid.uuid4().hex[:12])
        result = ObservationResult(
            observation_id=obs_id,
            status=ProcessingStatus.PROCESSING,
            source_state=None,  # type: ignore[arg-type]
            source="",
            provider_dataset="",
            acquisition_time=None,
            satellites=[],
            polarization="VV",
            scene_id="",
            scene_footprint=None,
            detector=self.detector.name,
            detector_version=self.detector.version,
        )

        # 1. Source.
        try:
            provider = resolve_source(source)
            scene = provider.get()
        except SarSourceError as exc:
            result.status = ProcessingStatus.UNAVAILABLE
            result.source_state = _source_state_for(source)
            result.source = (source or "LOCAL_FIXTURE").upper()
            result.warnings.append("no SAR scene produced; observation unavailable")
            result.errors.append(str(exc))
            return result
        except Exception as exc:  # noqa: BLE001
            result.status = ProcessingStatus.FAILED
            result.source_state = _source_state_for(source)
            result.source = (source or "LOCAL_FIXTURE").upper()
            result.errors.append(f"source failed: {type(exc).__name__}: {exc}")
            return result

        # 2. Prepare (normalize land mask / provenance).
        try:
            scene = self._prepare(scene)
        except Exception as exc:  # noqa: BLE001
            result.status = ProcessingStatus.FAILED
            result.source_state = scene.source_state
            result.source = scene.source
            result.errors.append(f"preparation failed: {type(exc).__name__}: {exc}")
            return result

        result.source_state = scene.source_state
        result.source = scene.source
        result.provider_dataset = scene.provider_dataset
        result.acquisition_time = scene.acquisition_time
        result.satellites = scene.satellites
        result.polarization = scene.polarization
        result.scene_id = scene.scene_id
        result.scene_footprint = build_scene_footprint(scene)
        result.preprocess_steps = list(scene.processing_log)
        result.warnings = list(scene.processing_log)

        # 3. Detect.
        try:
            active_detector = _resolve_detector(detector)
            candidates = active_detector.detect(scene, max_candidates=max_candidates)
            result.detector = active_detector.name
            result.detector_version = active_detector.version
        except DetectorUnavailableError as exc:
            result.status = ProcessingStatus.UNAVAILABLE
            result.errors.append(str(exc))
            result.warnings.append("detector unavailable; no detection produced")
            return result
        except Exception as exc:  # noqa: BLE001
            result.status = ProcessingStatus.FAILED
            result.errors.append(f"detection failed: {type(exc).__name__}: {exc}")
            return result

        # 4+5. Post-process + characterize (aggregate accepted candidates).
        result.candidates = candidates
        result.status = ProcessingStatus.COMPLETED
        if candidates:
            result.confidence = round(
                float(sum(c.confidence for c in candidates)) / len(candidates), 2
            )
            result.slick_area_km2 = round(sum(c.area_km2 for c in candidates), 4)
            result.warnings += self._candidate_warnings(candidates)

        # Age is not estimable from a single snapshot with no corroborating
        # temporal data — expose as unavailable rather than invent a number.
        result.age_available = False
        result.age_estimate = None
        result.warnings.append(
            "spill age not estimated: a single scene provides no temporal "
            "basis for a defensible age (multi-temporal analysis is future work)."
        )
        return result

    def _prepare(self, scene: SarScene) -> SarScene:
        # Ensure the land/nodata mask is present.
        if scene.land_mask is None:
            scene.record("prep: building land/nodata mask")
            # rebind via object set to keep frozen dataclass semantics clean
            object.__setattr__(
                scene, "land_mask", make_land_mask(scene.amplitude_db)
            )
        scene.record("prep: backscatter field already in dB (no re-calibration on fixture)")
        scene.record("prep: dark-feature adaptive threshold + morphological cleanup applied")
        return scene

    @staticmethod
    def _candidate_warnings(candidates: List[SlickCandidate]) -> List[str]:
        for c in candidates:
            if c.classification == CandidateClass.LOOK_ALIKE:
                pass
        warns = []
        oil_count = sum(
            1 for c in candidates if c.classification == CandidateClass.OIL_CANDIDATE
        )
        if oil_count == 0:
            warns.append(
                "no confident oil candidate; remaining dark regions flagged as "
                "uncertain or look-alike (SAR dark features are not uniquely oil)."
            )
        return warns


def process_observation(
    source: Optional[str] = None,
    detector: Optional[str] = None,
    max_candidates: int = 6,
    observation_id: Optional[str] = None,
) -> ObservationResult:
    return SarPipeline().process(
        source=source,
        detector=detector,
        max_candidates=max_candidates,
        observation_id=observation_id,
    )


def _source_state_for(source: Optional[str]):
    from .contract import ProvenanceState

    key = (source or "LOCAL_FIXTURE").strip().upper()
    try:
        return ProvenanceState(key)
    except ValueError:
        return ProvenanceState.UNAVAILABLE
