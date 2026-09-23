"""Live environmental data clients (free, no credentials).

Real internet feeds wired into the science stack and the command centre:

    Open-Meteo forecast + marine  -> live 10 m wind, gusts, waves, SST.
    NASA EONET v3                -> live marine incident feed (context).
    OpenTopoData ETOPO1          -> live ocean depth readout (context).

Every client is strictly read-only and never fabricates data. When the
network or the upstream feed fails the client marks the response
``available=False`` (with a human reason) so the UI treats it honestly as
UNAVAILABLE rather than guessing.

Only the standard library is used for HTTP (``urllib``) so the live layer
adds no new runtime dependencies.
"""

from __future__ import annotations

import json
import logging
import math
import os
import time as _time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

try:  # optional cache (declared dependency)
    from cachetools import TTLCache as _TTLCache
except Exception:  # pragma: no cover - degrade to no cache when absent
    _TTLCache = None

log = logging.getLogger("oilspill.environment.live")

_WIND_URL = "https://api.open-meteo.com/v1/forecast"
_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
_EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"
_DEPTH_URL = "https://api.opentopodata.org/v1/etopo1"

_DEFAULT_TIMEOUT_SECONDS = 12.0

# EONET has no dedicated oil-spill category, so the marine incident feed
# watches the manmade / wildfire categories and matches event titles against
# oil-pollution vocabulary. Keyword matching only ever *retains* real events;
# it never synthesises one.
_EONET_CATEGORIES = ("manmade", "wildfires")
_INCIDENT_KEYWORDS = (
    "oil",
    "spill",
    "slick",
    "crude",
    "tanker",
    "pipeline",
    "rig",
    "pollution",
)


def _iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except Exception:  # pragma: no cover
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(float(os.getenv(name, str(default))))
    except Exception:  # pragma: no cover
        return default


# -- HTTP -------------------------------------------------------------------


def _fetch_json(url: str, params: Dict[str, Any]) -> Any:
    """GET ``url`` with URL-encoded query params, returning parsed JSON.

    Uses ``urllib`` plus a per-URL small cache (``urllib`` URL + params form
    the key) so repeated live reads in a demo run do not hammer the feed.
    """
    from urllib.parse import urlencode
    from urllib.request import urlopen

    querystring = urlencode(params)
    full = f"{url}?{querystring}" if params else url
    cached = _CACHE.get(full)
    if cached is not None:
        return cached
    req = urlopen(full, timeout=int(_env_float("LIVE_FETCH_TIMEOUT_SECONDS", _DEFAULT_TIMEOUT_SECONDS)))
    with req as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    _CACHE[full] = payload
    return payload


if _TTLCache is not None:
    _CACHE = _TTLCache(
        maxsize=256,
        ttl=_env_int("LIVE_FETCH_CACHE_TTL_SECONDS", 900),
    )
else:  # pragma: no cover
    _CACHE = None  # type: ignore[assignment]


# -- Open-Meteo (live wind + waves) -----------------------------------------
#
# Open-Meteo exposes two hosts:
#   * api.open-meteo.com/v1/forecast   -> 10 m wind + gusts (met-ocean grid)
#   * marine-api.open-meteo.com/v1/marine -> waves + SST (WAM model)
# Both are open, no key, CORS-open. Wind direction is meteorological (the
# direction the wind is *from*); converted to east/north components for the
# drift engine below.


def fetch_wind_series(latitude: float, longitude: float) -> List[Dict[str, Any]]:
    """Hourly 10 m wind + gusts from Open-Meteo forecast (m/s)."""
    payload = _fetch_json(
        _WIND_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
            "windspeed_unit": "ms",
            "forecast_days": 3,
            "timezone": "UTC",
        },
    )
    hourly = payload.get("hourly", {})
    times = list(hourly.get("time", []) or [])
    rows: List[Dict[str, Any]] = []
    for i, stamp in enumerate(times):
        def _val(key: str) -> Optional[float]:
            col = hourly.get(key)
            if not isinstance(col, list) or i >= len(col):
                return None
            v = col[i]
            return float(v) if v is not None else None

        rows.append(
            {
                "time": stamp,
                "wind_speed_10m": _val("wind_speed_10m"),
                "wind_direction_10m": _val("wind_direction_10m"),
                "wind_gusts_10m": _val("wind_gusts_10m"),
            }
        )
    return rows


def fetch_marine_series(latitude: float, longitude: float) -> List[Dict[str, Any]]:
    """Hourly wave height/direction/period + SST from Open-Meteo marine."""
    payload = _fetch_json(
        _MARINE_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": "wave_height,wave_direction,wave_period,sea_surface_temperature",
            "forecast_days": 3,
            "timezone": "UTC",
        },
    )
    hourly = payload.get("hourly", {})
    times = list(hourly.get("time", []) or [])
    rows: List[Dict[str, Any]] = []
    for i, stamp in enumerate(times):
        def _val(key: str) -> Optional[float]:
            col = hourly.get(key)
            if not isinstance(col, list) or i >= len(col):
                return None
            v = col[i]
            return float(v) if v is not None else None

        rows.append(
            {
                "time": stamp,
                "wave_height": _val("wave_height"),
                "wave_direction": _val("wave_direction"),
                "wave_period": _val("wave_period"),
                "sea_surface_temperature": _val("sea_surface_temperature"),
            }
        )
    return rows


def wind_to_uv(speed_ms: Optional[float], direction_deg: Optional[float]) -> Tuple[float, float]:
    """Convert Open-Meteo wind (speed m/s, *from* direction deg) to u/v.

    Drift advection uses eastward (u) / northward (v) components in m/s.
    ``direction_deg`` is meteorological (where the wind comes from), so the
    vector points in the direction the air is *moving* (from + 180).
    """
    if speed_ms is None or direction_deg is None:
        return 0.0, 0.0
    blow = math.radians((direction_deg + 180.0) % 360.0)
    return speed_ms * math.sin(blow), speed_ms * math.cos(blow)


def nearest_wind_row(rows: List[Dict[str, Any]], stamp) -> Optional[Dict[str, Any]]:
    """The wind sample whose UTC hour is closest to ``stamp`` (naive UTC)."""
    if not rows:
        return None
    target = stamp
    if target.tzinfo is not None:
        target = target.astimezone(timezone.utc).replace(tzinfo=None)
    best: Optional[Dict[str, Any]] = None
    best_gap: Optional[float] = None
    for row in rows:
        try:
            sample = datetime.strptime(row["time"], "%Y-%m-%dT%H:%M")
        except (KeyError, ValueError):  # pragma: no cover
            continue
        gap = abs((sample - target).total_seconds())
        if best_gap is None or gap < best_gap:
            best, best_gap = row, gap
    return best


def fetch_live_weather(latitude: float, longitude: float) -> Dict[str, Any]:
    """Combined live wind + wave snapshot for the command centre overlay.

    Never raises: a failed upstream (offline, feed error) returns a payload
    with ``available=False`` and a reason so callers stay honest.
    """
    base: Dict[str, Any] = {
        "available": False,
        "source": "Open-Meteo (live)",
        "latitude": latitude,
        "longitude": longitude,
        "fetched_at": _iso_now(),
        "reason": "Not fetched yet.",
    }
    try:
        wind = fetch_wind_series(latitude, longitude)
        waves = fetch_marine_series(latitude, longitude)
    except Exception as exc:  # noqa: BLE001 - honest UNAVAILABLE
        base["reason"] = f"Open-Meteo UNAVAILABLE: {type(exc).__name__}: {exc}"
        log.warning("live weather unavailable: %s", base["reason"])
        return base
    base["available"] = True
    base["reason"] = None
    base["wind"] = {
        "source": "Open-Meteo forecast",
        "model": "GFS (met-ocean)",
        "hourly": wind,
    }
    base["waves"] = {
        "source": "Open-Meteo marine",
        "model": "WAM (marine)",
        "hourly": waves,
    }
    return base


# -- NASA EONET v3 (live marine incidents) ----------------------------------


def fetch_incidents(
    bbox: Optional[Tuple[float, float, float, float]] = None,
    since_days: int = 14,
) -> Dict[str, Any]:
    """Live NASA EONET events matched to oil-pollution vocabulary.

    EONET exposes no oil-spill category, so real manmade/wildfire events are
    keyword-filtered. The result is a *real* feed: an empty ``events`` list
    means no matching event is currently reported in the area.
    """
    base: Dict[str, Any] = {
        "available": False,
        "source": "NASA EONET v3",
        "fetched_at": _iso_now(),
        "reason": "Not fetched yet.",
        "event_count": 0,
        "events": [],
    }
    params: Dict[str, Any] = {"status": "open", "limit": 100, "days": since_days}
    if bbox:
        params["bbox"] = ",".join(str(round(v, 4)) for v in bbox)
    try:
        payload = _fetch_json(_EONET_URL, params)
    except Exception as exc:  # noqa: BLE001 - honest UNAVAILABLE
        base["reason"] = f"EONET UNAVAILABLE: {type(exc).__name__}: {exc}"
        log.warning("incident feed unavailable: %s", base["reason"])
        return base

    events = list(payload.get("events", []) or [])
    matched: List[Dict[str, Any]] = []
    for ev in events:
        categories = {c.get("id") for c in ev.get("categories", []) or [] if isinstance(c, dict)}
        if not categories.intersection(_EONET_CATEGORIES):
            continue
        title = str(ev.get("title") or "")
        description = str(ev.get("description") or "")
        haystack = f"{title} {description}".lower()
        if not any(k in haystack for k in _INCIDENT_KEYWORDS):
            continue
        geometries = list(ev.get("geometry", []) or [])
        if not geometries:
            continue
        matched.append(
            {
                "id": ev.get("id"),
                "title": title,
                "categories": sorted(categories),
                "geometry": geometries[-1],
                "geometry_count": len(geometries),
                "sources": list(ev.get("sources", []) or []),
                "closed": ev.get("closed"),
            }
        )

    base["available"] = True
    base["reason"] = None
    base["event_count"] = len(matched)
    base["events"] = matched
    return base


# -- OpenTopoData ETOPO1 (live ocean depth) ---------------------------------


def fetch_depth(latitude: float, longitude: float) -> Dict[str, Any]:
    """Live ocean depth (m) at a coordinate from the ETOPO1 global grid.

    Uses the public no-key OpenTopoData endpoint. Negative elevation == land
    (depth < 0 for the seabed); the payload reports ``depth_m`` as a positive
    number over water.
    """
    base: Dict[str, Any] = {
        "available": False,
        "source": "ETOPO1 (OpenTopoData)",
        "fetched_at": _iso_now(),
        "reason": "Not fetched yet.",
        "depth_m": None,
    }
    try:
        payload = _fetch_json(_DEPTH_URL, {"locations": f"{latitude},{longitude}"})
    except Exception as exc:  # noqa: BLE001 - honest UNAVAILABLE
        base["reason"] = f"ETOPO1 UNAVAILABLE: {type(exc).__name__}: {exc}"
        log.warning("depth readout unavailable: %s", base["reason"])
        return base

    results = list(payload.get("results", []) or [])
    if not results:
        base["reason"] = "ETOPO1 returned no result for the location."
        return base
    elevation = results[0].get("elevation")
    if elevation is None:
        base["reason"] = "ETOPO1 returned no elevation for the location."
        return base
    base["available"] = True
    base["reason"] = None
    base["depth_m"] = round(-float(elevation), 1)
    base["elevation_m"] = round(float(elevation), 1)
    base["query"] = results[0].get("location")
    return base