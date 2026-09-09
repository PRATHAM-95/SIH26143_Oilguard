"""Prometheus observability helpers for the scientific service.

Graceful degradation: if the optional metric libraries are not installed the
app still boots and serves normally (just without the ``/metrics`` endpoint
and step timers). Instrumentation is registered once via ``instrument_app``.

Exposes:

  * ``/metrics`` — OpenMetrics text exposition (request-rate + latency
    histograms for every route, via prometheus-fastapi-instrumentator).
  * ``scientific_service_call_duration_seconds`` — histogram of the expensive
    science pipeline calls (forward-drift, SAR, backtrack, AIS, validation).
  * ``scientific_service_calls_total`` — call counter split by outcome.
"""

from __future__ import annotations

import logging
import time as _time
from functools import wraps
from typing import Any, Callable, TypeVar

log = logging.getLogger("oilspill.observability")

try:  # optional runtime dependency (see requirements.txt)
    from prometheus_client import Counter, Histogram
    from prometheus_fastapi_instrumentator import Instrumentator

    _PROMETHEUS = True
except Exception:  # pragma: no cover - optional dependency
    Counter = None  # type: ignore
    Histogram = None  # type: ignore
    Instrumentator = None  # type: ignore
    _PROMETHEUS = False

_EXCLUDE = (".*/metrics",)

if _PROMETHEUS:
    SCIENCE_DURATION: Histogram | None = Histogram(
        "scientific_service_call_duration_seconds",
        "Duration of science pipeline calls",
        ["endpoint"],
    )
    SCIENCE_CALLS: Counter | None = Counter(
        "scientific_service_calls_total",
        "Science pipeline call count",
        ["endpoint", "outcome"],
    )
else:
    SCIENCE_DURATION = None
    SCIENCE_CALLS = None

F = TypeVar("F", bound=Callable[..., Any])


def instrument_app(app: Any) -> None:
    """Register the Prometheus exporter on ``app`` (no-op if unavailable)."""
    if not _PROMETHEUS:
        log.warning("prometheus-fastapi-instrumentator not installed; /metrics disabled")
        return
    Instrumentator(
        excluded_handlers=["/health", "/metrics", "/docs", "/openapi.json"],
    ).instrument(app).expose(app)


def _record(endpoint: str, duration_s: float, outcome: str) -> None:
    if SCIENCE_DURATION is not None:
        SCIENCE_DURATION.labels(endpoint=endpoint).observe(duration_s)
    if SCIENCE_CALLS is not None:
        SCIENCE_CALLS.labels(endpoint=endpoint, outcome=outcome).inc()


def observe(endpoint: str):
    """Decorator: record duration + outcome for a science pipeline call."""
    def deco(fn: F) -> F:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            t0 = _time.monotonic()
            try:
                result = fn(*args, **kwargs)
            except Exception:
                _record(endpoint, _time.monotonic() - t0, "error")
                raise
            _record(endpoint, _time.monotonic() - t0, "success")
            return result

        return wrapper  # type: ignore[return-value]

    return deco