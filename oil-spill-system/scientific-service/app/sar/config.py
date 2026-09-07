"""SAR configuration.

Reads any real-data credentials (Copernicus Data Space) and model/detector
paths from the process environment rather than hard-coding them, mirroring
``app.environment.config``. Providers report AVAILABLE / UNAVAILABLE based on
what the operator has actually configured; the pipeline never fakes a real
scene.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class SarConfig:
    """Configuration that determines which SAR sources/detectors can run."""

    # Copernicus Data Space Ecosystem (CDSE) OData credentials for real
    # Sentinel-1 scene retrieval.
    cdse_username: str = field(default_factory=lambda: os.getenv("CDSE_USERNAME", ""))
    cdse_password: str = field(default_factory=lambda: os.getenv("CDSE_PASSWORD", ""))

    # Optional ONNX segmentation weights (activation of the ML detector).
    # Only if a real artifact is present on disk is the ONNX detector offered;
    # otherwise the classical dark-spot detector is the honest default.
    onnx_model_path: str = field(
        default_factory=lambda: os.getenv("SAR_ONNX_MODEL", "")
    )

    # Directory of committed local SAR fixtures (clearly labelled DEMO/SYNTHETIC).
    fixtures_dir: str = field(
        default_factory=lambda: os.getenv(
            "SAR_FIXTURES_DIR",
            str(Path(__file__).resolve().parent / "fixtures"),
        )
    )

    # Directory where real Sentinel-1 GRD products would be cached after a
    # (credential-gated) download. When empty, CACHED_SENTINEL1 stays
    # unavailable.
    sar_cache_dir: str = field(
        default_factory=lambda: os.getenv("SAR_CACHE_DIR", "")
    )

    # Default detection configuration (classical dark-spot tuning).
    default_polarization: str = field(default="VV")
    default_max_candidates: int = field(default=6)

    @property
    def cdse_available(self) -> bool:
        return bool(self.cdse_username and self.cdse_password)

    @property
    def onnx_available(self) -> bool:
        return bool(self.onnx_model_path) and os.path.exists(self.onnx_model_path)

    @property
    def cache_available(self) -> bool:
        return bool(self.sar_cache_dir) and os.path.isdir(self.sar_cache_dir)


@lru_cache(maxsize=1)
def get_sar_config() -> SarConfig:
    """Read the effective SAR configuration once per process."""
    return SarConfig()


def report_sar_availability() -> dict:
    """Human/API-facing report of which SAR sources/detectors can run."""
    cfg = get_sar_config()
    return {
        "sar": {
            "source": {
                "local_fixture": {"status": "AVAILABLE", "note": "Committed demo fixture (SYNTHETIC/DEMO, not real Sentinel-1)."},
                "synthetic": {"status": "AVAILABLE", "note": "Deterministic generated test scene (SYNTHETIC)."},
                "cached_sentinel1": {
                    "status": "AVAILABLE" if cfg.cache_available else "UNAVAILABLE",
                    "note": "Cached real Sentinel-1 scene(s) present." if cfg.cache_available
                    else "No cached real Sentinel-1 scene configured (set SAR_CACHE_DIR).",
                },
                "real_sentinel1": {
                    "status": "AVAILABLE" if cfg.cdse_available else "UNAVAILABLE",
                    "note": "Copernicus Data Space credentials configured; live OData download enabled." if cfg.cdse_available
                    else "Missing CDSE_USERNAME/CDSE_PASSWORD (anonymous STAC catalog search remains available via GET /api/sar/catalog).",
                },
            },
            "detector": {
                "classical_dark_spot": {"status": "AVAILABLE", "note": "Deterministic adaptive-threshold baseline v2 (CPU, offline, contrast-gated)."},
                "onnx": {
                    "status": "AVAILABLE" if cfg.onnx_available else "UNAVAILABLE",
                    "note": "ONNX weights present." if cfg.onnx_available
                    else "No SAR_ONNX_MODEL artifact configured; classical detector used.",
                },
            },
        }
    }
