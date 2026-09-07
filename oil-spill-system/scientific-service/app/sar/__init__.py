"""SAR oil-spill detection module.

Source -> preparation -> detection -> post-processing -> characterization ->
observation. Provides a clean boundary so the detector can be swapped later
without rewriting the application.
"""

from .config import get_sar_config, report_sar_availability
from .contract import (
    CandidateClass,
    ObservationResult,
    ProcessingStatus,
    ProvenanceState,
    SarScene,
    SlickCandidate,
)
from .detectors import DetectorUnavailableError, SarDetector
from .detectors.classical import ClassicalDarkSpotDetector
from .detectors.onnx import OnnxSegmentationDetector
from .pipeline import process_observation, build_scene_footprint
from .scenes import SarSourceError, resolve_source

__all__ = [
    "get_sar_config",
    "report_sar_availability",
    "CandidateClass",
    "ObservationResult",
    "ProcessingStatus",
    "ProvenanceState",
    "SarScene",
    "SlickCandidate",
    "DetectorUnavailableError",
    "SarDetector",
    "ClassicalDarkSpotDetector",
    "OnnxSegmentationDetector",
    "process_observation",
    "build_scene_footprint",
    "SarSourceError",
    "resolve_source",
]
