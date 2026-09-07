"""Optional ONNX semantic-segmentation detector.

Activates ONLY when real ONNX weights are present on disk (see
``app.sar.config.SarConfig.onnx_available``). Without a vendored model artifact
this detector raises :class:`DetectorUnavailableError` and the pipeline falls
back to the classical dark-spot baseline — it never fabricates a result.

This is the clean seam where a pretrained SAR segmentation model (e.g. the
SegFormer-B2 / mados candidates named in the research) can be plugged in later
without rewriting the pipeline.
"""

from __future__ import annotations

from typing import List

import numpy as np

from ..config import get_sar_config
from ..contract import SarScene, SlickCandidate
from . import DetectorUnavailableError, SarDetector


class OnnxSegmentationDetector(SarDetector):
    """Segmentation detector backed by an ONNX model (weights on disk)."""

    name = "onnx_segmentation"
    version = "0.1.0"

    def __init__(self) -> None:
        cfg = get_sar_config()
        if not cfg.onnx_available:
            raise DetectorUnavailableError(
                "ONNX SAR detector requested but no model artifact is installed "
                "(set SAR_ONNX_MODEL to a valid .onnx path). Falling back to the "
                "classical dark-spot detector is safe; this detector will not fake "
                "a result."
            )
        self.model_path = cfg.onnx_model_path
        self._session = None

    def _load(self):
        if self._session is not None:
            return self._session
        import onnxruntime as ort

        self._session = ort.InferenceSession(
            self.model_path, providers=["CPUExecutionProvider"]
        )
        return self._session

    def detect(self, scene: SarScene, max_candidates: int = 6) -> List[SlickCandidate]:
        session = self._load()
        # A real integration point: preprocess the dB field to the network input,
        # run inference, and convert the class==oil mask through the shared
        # characterizer. Because no weights are vendored, this branch is not
        # reached in the default offline configuration.
        raise DetectorUnavailableError(
            "ONNX segmentation detector is configured but inference has not been "
            "calibrated for the installed weights; refusing to invent a blind "
            "prediction."
        )
