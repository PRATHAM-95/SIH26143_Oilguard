"""STEP 10 — historical AIS reconstruction + vessel attribution.

Public surface:
    GET  /api/ais/availability   (handler in main.py)
    POST /api/ais/query
    POST /api/ais/filter
    POST /api/score-vessels
    POST /api/attribution/validate

All pipeline stages are deterministic and provenance-stamped. Simulated AIS
(controlled-ais-v1) is always labelled CONTROLLED; real-data feeds report
UNAVAILABLE with an explicit reason rather than fabricating traffic.
"""

from .config import get_ais_config, report_ais_availability
from .providers import (
    AisStreamProvider,
    ControlledAisProvider,
    GfwAisProvider,
    MarineCadastreProvider,
    resolve_ais_provider,
)
from .scoring import FIVE_FACTOR_WEIGHTS, MODEL_VERSION

__all__ = [
    "get_ais_config",
    "report_ais_availability",
    "resolve_ais_provider",
    "ControlledAisProvider",
    "GfwAisProvider",
    "MarineCadastreProvider",
    "AisStreamProvider",
    "FIVE_FACTOR_WEIGHTS",
    "MODEL_VERSION",
]