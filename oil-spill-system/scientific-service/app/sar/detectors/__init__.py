"""Detector base classes.

The SAR pipeline isolates detection behind a small interface so a different
detector (e.g. an ONNX semantic-segmentation model once weights are vendored)
can be swapped in without rewriting the rest of the application.

Every detector produces :class:`SlickCandidate` objects with an explicit
classification + confidence. Detectors never fabricate a slick: a scene with
no dark oil-like region yields zero candidates.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List

from ..contract import SarScene, SlickCandidate


class SarDetector(ABC):
    """Base class for SAR oil-slick detectors."""

    name: str = "unknown"
    version: str = "unknown"

    @abstractmethod
    def detect(self, scene: SarScene, max_candidates: int = 6) -> List[SlickCandidate]:
        """Return candidate slicks detected in ``scene`` (possibly empty)."""
        raise NotImplementedError


class DetectorUnavailableError(RuntimeError):
    """Raised when a requested detector cannot actually run (no model, etc.)."""
