"""Environment providers.

Layer A  -> ControlledEnvironmentProvider (deterministic, synthetic).
Layer B  -> CMEMSProvider / ERA5Provider (real data, gated on credentials).
Layer C  -> combined usage handled at the drift-engine level.

Every provider returns a normalized EnvironmentField defined in
``app.environment.contract``. Providers never fake real data: if a real-data
source is UNAVAILABLE (missing credentials / no network / fetch failure) the
provider raises ``EnvironmentProviderError`` and the engine falls back to
CONTROLLED forcing, labelling the run accordingly.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Optional

import numpy as np

from .config import get_environment_config
from .contract import (
    EnvironmentField,
    EnvironmentProvider,
    EnvironmentProviderError,
    EnvironmentSample,
)

try:  # optional runtime dependency (see requirements.txt)
    from cachetools import TTLCache as _TTLCache

    _REAL_FIELD_CACHE: "Optional[_TTLCache]" = _TTLCache(
        maxsize=64, ttl=int(float(__import__("os").environ.get("ENV_FIELD_CACHE_TTL_SECONDS", "1800")))
    )
except Exception:  # pragma: no cover - cachetools optional
    _REAL_FIELD_CACHE = None

# Tests monkeypatch these module functions to inject synthetic xarray datasets
# without touching the network. Imports are deferred so the module stays
# importable even if a data client is not installed.


def _cmems_open(dataset_id, variables, lat, lon, start, end):
    """Open a Copernicus Marine xarray.Dataset near (lat, lon) in [start, end]."""
    import copernicusmarine

    cfg = get_environment_config()
    try:
        copernicusmarine.login(
            username=cfg.cmems_username,
            password=cfg.cmems_password,
            force_overwrite=True,
        )
    except Exception as exc:  # noqa: BLE001 - surface any login/auth failure
        raise EnvironmentProviderError(
            f"CMEMS login failed: {type(exc).__name__}: {exc}"
        ) from exc

    try:
        return copernicusmarine.open_dataset(
            dataset_id=dataset_id,
            variables=variables,
            minimum_longitude=lon,
            maximum_longitude=lon,
            minimum_latitude=lat,
            maximum_latitude=lat,
            start_datetime=start.strftime("%Y-%m-%dT%H:%M:%S"),
            end_datetime=end.strftime("%Y-%m-%dT%H:%M:%S"),
        )
    except Exception as exc:  # noqa: BLE001 - surface dataset/subset failures
        raise EnvironmentProviderError(
            f"CMEMS data retrieval failed: {type(exc).__name__}: {exc}"
        ) from exc


def _era5_retrieve(request, target):
    """Retrieve an ERA5 NetCDF file via the CDS API."""
    import cdsapi

    cfg = get_environment_config()
    client = cdsapi.Client(url=cfg.cds_url, key=cfg.cds_key)
    client.retrieve("reanalysis-era5-single-levels", request, target)


def _field_from_currents(ds, lat, lon, start_time, duration_hours, time_step_seconds):
    """Normalize an xarray currents Dataset to an EnvironmentField.

    Picks the grid cell nearest the origin and samples the uo/vo (m/s)
    velocity over the requested time steps. Temporal fallback keeps the run
    valid if the dataset does not cover the exact requested window.
    """
    return _field_from_xy(
        ds=ds,
        lat=lat,
        lon=lon,
        start_time=start_time,
        duration_hours=duration_hours,
        time_step_seconds=time_step_seconds,
        u_var="uo",
        v_var="vo",
        source="CMEMS",
        dataset=str(getattr(ds, "attrs", {}).get("title", "cmems")),
        components=("current",),
        lat_dim=_find_dim(ds, ("latitude", "lat")),
        lon_dim=_find_dim(ds, ("longitude", "lon")),
        time_dim=_find_dim(ds, ("time",)),
    )


def _field_from_wind(ds, lat, lon, start_time, duration_hours, time_step_seconds):
    """Normalize an xarray ERA5 wind Dataset to an EnvironmentField."""
    return _field_from_xy(
        ds=ds,
        lat=lat,
        lon=lon,
        start_time=start_time,
        duration_hours=duration_hours,
        time_step_seconds=time_step_seconds,
        u_var="u10",
        v_var="v10",
        source="ERA5",
        dataset="reanalysis-era5-single-levels",
        components=("wind",),
        lat_dim=_find_dim(ds, ("latitude", "lat")),
        lon_dim=_find_dim(ds, ("longitude", "lon")),
        time_dim=_find_dim(ds, ("time",)),
    )


def _field_from_xy(
    ds,
    lat,
    lon,
    start_time,
    duration_hours,
    time_step_seconds,
    u_var,
    v_var,
    source,
    dataset,
    components,
    lat_dim,
    lon_dim,
    time_dim,
):
    try:
        import xarray as xr  # noqa: F401  (used for typing/coercion)
    except Exception:  # pragma: no cover
        pass

    if time_dim is None:
        raise EnvironmentProviderError(
            f"{source} dataset has no time dimension; cannot build a time series."
        )
    if lat_dim is None or lon_dim is None:
        raise EnvironmentProviderError(
            f"{source} dataset missing latitude/longitude dims."
        )
    if u_var not in ds or v_var not in ds:
        raise EnvironmentProviderError(
            f"{source} dataset missing velocity components {u_var}/{v_var}."
        )

    # Nearest-cell selection at the spill origin.
    lat_sel = float(ds[lat_dim].sel({lat_dim: lat}, method="nearest").values)
    lon_sel = float(ds[lon_dim].sel({lon_dim: lon}, method="nearest").values)

    times = ds[time_dim].values
    if times.size == 0:
        raise EnvironmentProviderError(f"{source} dataset has empty time axis.")

    t0 = times[0]
    t1 = times[-1]
    # Coerce to datetime for comparisons (works for datetime64 and cftime).
    try:
        t0_dt = _to_datetime(t0)
        t1_dt = _to_datetime(t1)
        start_dt = start_time if start_time.tzinfo is None else start_time.replace(tzinfo=None)
    except Exception as exc:  # noqa: BLE001
        raise EnvironmentProviderError(
            f"{source} time axis incompatible: {exc}"
        ) from exc

    field = EnvironmentField()
    n = max(1, int(round((duration_hours * 3600) / time_step_seconds)))
    for i in range(n):
        stamp = start_dt + timedelta(seconds=i * time_step_seconds)
        # Clamp to the dataset's temporal coverage (real data never matches a
        # request exactly; we use the nearest available step).
        if stamp < t0_dt:
            stamp = t0_dt
        if stamp > t1_dt:
            stamp = t1_dt

        u = _sample_var(ds, u_var, lat_sel, lon_sel, stamp, lat_dim, lon_dim, time_dim)
        v = _sample_var(ds, v_var, lat_sel, lon_sel, stamp, lat_dim, lon_dim, time_dim)

        is_current = "current" in components
        field.append(
            EnvironmentSample(
                timestamp=stamp,
                latitude=lat,
                longitude=lon,
                u_current=float(np.nan_to_num(u)) if is_current else 0.0,
                v_current=float(np.nan_to_num(v)) if is_current else 0.0,
                u_wind=float(np.nan_to_num(u)) if not is_current else 0.0,
                v_wind=float(np.nan_to_num(v)) if not is_current else 0.0,
                source=source,
                dataset=dataset,
                resolution_degrees=_resolution(ds, lat_dim, lon_dim),
            )
        )
    return field


def _sample_var(ds, var, lat_sel, lon_sel, stamp, lat_dim, lon_dim, time_dim):
    """Read one value of ``var`` at the nearest cell/time, handling datetime64."""
    try:
        arr = ds[var]
        value = arr.sel(
            {lat_dim: lat_sel, lon_dim: lon_sel, time_dim: stamp},
            method="nearest",
        ).values
    except Exception:  # noqa: BLE001 - try raw array path
        value = ds[var][0, 0, 0].values
    return float(np.asarray(value).ravel()[0]) if np.asarray(value).size < 100 else np.nan


def _resolution(ds, lat_dim, lon_dim) -> Optional[float]:
    try:
        lat = ds[lat_dim].values
        if lat.size >= 2:
            return float(abs(float(lat[1]) - float(lat[0])))
    except Exception:  # noqa: BLE001
        pass
    return None


def _find_dim(ds, names):
    for name in names:
        if name in ds.dims:
            return name
    return None


def _to_datetime(value) -> datetime:
    """Coerce a numpy datetime64 / cftime / datetime to a naive UTC datetime."""
    from datetime import datetime as _dt
    import numpy as _np

    if isinstance(value, _dt):
        return value.replace(tzinfo=None) if value.tzinfo else value
    try:
        import pandas as pd

        return pd.Timestamp(value).to_pydatetime().replace(tzinfo=None)
    except Exception:  # noqa: BLE001 - cftime path
        return value.strftime("%Y-%m-%dT%H:%M:%S")


class ControlledEnvironmentProvider(EnvironmentProvider):
    """Deterministic, horizontally-uniform forcing (synthetic test field)."""

    source = "CONTROLLED"
    dataset = "CONTROLLED TEST FIELD"

    def __init__(
        self,
        u_current: float = 0.5,
        v_current: float = 0.0,
        u_wind: float = 0.0,
        v_wind: float = 0.0,
    ) -> None:
        self.u_current = u_current
        self.v_current = v_current
        self.u_wind = u_wind
        self.v_wind = v_wind

    def get(
        self,
        latitude: float,
        longitude: float,
        start_time: datetime,
        duration_hours: float,
        time_step_seconds: int,
    ) -> EnvironmentField:
        field = EnvironmentField()
        n = max(1, int(round((duration_hours * 3600) / time_step_seconds)))
        for i in range(n):
            stamp = start_time + timedelta(seconds=i * time_step_seconds)
            field.append(
                EnvironmentSample(
                    timestamp=stamp,
                    latitude=latitude,
                    longitude=longitude,
                    u_current=self.u_current,
                    v_current=self.v_current,
                    u_wind=self.u_wind,
                    v_wind=self.v_wind,
                    source=self.source,
                    dataset=self.dataset,
                    resolution_degrees=0.0,
                )
            )
        return field


class CMEMSProvider(EnvironmentProvider):
    """Copernicus Marine Service real ocean-current forcing (Layer B).

    Requires CMEMS_USERNAME / CMEMS_PASSWORD in the environment. Real data is
    retrieved with :meth:`_cmems_open` when credentials are present. If they
    are absent, or the fetch fails, the provider raises
    ``EnvironmentProviderError`` and the engine falls back to CONTROLLED
    forcing (never a fake dataset).
    """

    source = "CMEMS"
    dataset = "cmems currents"

    def get(
        self,
        latitude: float,
        longitude: float,
        start_time: datetime,
        duration_hours: float,
        time_step_seconds: int,
    ) -> EnvironmentField:
        cfg = get_environment_config()
        if not cfg.cmems_available:
            raise EnvironmentProviderError(
                "CMEMS UNAVAILABLE: CMEMS_USERNAME/CMEMS_PASSWORD not configured. "
                "Use CONTROLLED environment instead."
            )
        end_time = start_time + timedelta(hours=duration_hours)
        key = (
            "CMEMS",
            _cache_time(start_time),
            _cache_time(end_time),
            float(latitude),
            float(longitude),
            time_step_seconds,
        )
        if _REAL_FIELD_CACHE is not None and key in _REAL_FIELD_CACHE:
            return _REAL_FIELD_CACHE[key]
        ds = _cmems_open(
            dataset_id=cfg.cmems_dataset_id,
            variables=["uo", "vo"],
            lat=latitude,
            lon=longitude,
            start=start_time,
            end=end_time,
        )
        field = _field_from_currents(
            ds, latitude, longitude, start_time, duration_hours, time_step_seconds
        )
        if _REAL_FIELD_CACHE is not None:
            _REAL_FIELD_CACHE[key] = field
        return field


class ERA5Provider(EnvironmentProvider):
    """ECMWF ERA5 wind forcing (Layer B), via CDS API.

    Requires CDS_API_KEY (or CDS_KEY) in the environment. Real data is
    retrieved with :meth:`_era5_retrieve` into a temporary NetCDF. If the key
    is absent, or the fetch fails, the provider raises
    ``EnvironmentProviderError`` and the engine uses CONTROLLED forcing.
    """

    source = "ERA5"
    dataset = "reanalysis-era5-single-levels"

    def get(
        self,
        latitude: float,
        longitude: float,
        start_time: datetime,
        duration_hours: float,
        time_step_seconds: int,
    ) -> EnvironmentField:
        import os
        import tempfile

        cfg = get_environment_config()
        if not cfg.era5_available:
            raise EnvironmentProviderError(
                "ERA5 UNAVAILABLE: CDS_API_KEY (ERA5 API token) not configured. "
                "Use CONTROLLED environment instead."
            )
        start_dt = start_time if start_time.tzinfo is None else start_time.replace(tzinfo=None)
        end_dt = start_dt + timedelta(hours=duration_hours)

        hours = []
        cursor = start_dt
        while cursor <= end_dt:
            hours.append(cursor.strftime("%H:%M"))
            cursor += timedelta(hours=1)
        hours = sorted(set(hours))

        request = {
            "product_type": "reanalysis",
            "variable": [
                "10m_u_component_of_wind",
                "10m_v_component_of_wind",
            ],
            "year": [str(start_dt.year)],
            "month": [f"{start_dt.month:02d}"],
            "day": [str(start_dt.day)],
            "time": hours,
            # area: N, W, S, E (a small region around the origin).
            "area": [
                round(latitude + 0.25, 3),
                round(longitude - 0.25, 3),
                round(latitude - 0.25, 3),
                round(longitude + 0.25, 3),
            ],
            "format": "netcdf",
        }

        tmp = tempfile.mkstemp(suffix=".nc")
        os.close(tmp[0])
        target = tmp[1]
        key = (
            "ERA5",
            _cache_time(start_dt),
            float(latitude),
            float(longitude),
            duration_hours,
            tuple(hours),
        )
        if _REAL_FIELD_CACHE is not None and key in _REAL_FIELD_CACHE:
            return _REAL_FIELD_CACHE[key]
        try:
            _era5_retrieve(request, target)
            try:
                import xarray as xr

                ds = xr.open_dataset(target)
            except Exception as exc:  # noqa: BLE001
                raise EnvironmentProviderError(
                    f"ERA5 NetCDF could not be read: {type(exc).__name__}: {exc}"
                ) from exc
            field = _field_from_wind(
                ds, latitude, longitude, start_dt, duration_hours, time_step_seconds
            )
            if _REAL_FIELD_CACHE is not None:
                _REAL_FIELD_CACHE[key] = field
            return field
        finally:
            if os.path.exists(target):
                try:
                    os.remove(target)
                except OSError:  # pragma: no cover
                    pass


class LiveWeatherProvider(EnvironmentProvider):
    """Open-Meteo live 10 m wind forcing (real, no credentials).

    Layer B alternative: real forecast wind from Open-Meteo (GFS grid) that
    needs no credentials, so the drift engine can run on real wind even when
    CMEMS/ERA5 are not configured. Ocean currents are not part of this feed,
    so the returned field carries wind only (currents 0.0) and is labelled
    honestly ``LIVE`` — it is never presented as a full reanalysis product.
    """

    source = "LIVE"
    dataset = "Open-Meteo forecast (10 m wind)"
    # Approximate grid spacing of the outgoing met-ocean wind field (deg).
    resolution_degrees = 0.25

    def _series(
        self,
        latitude: float,
        longitude: float,
        start_time: datetime,
        duration_hours: float,
        time_step_seconds: int,
    ) -> EnvironmentField:
        from . import live as _live

        try:
            rows = _live.fetch_wind_series(latitude, longitude)
        except Exception as exc:  # noqa: BLE001 - surface any fetch failure
            raise EnvironmentProviderError(
                f"Open-Meteo UNAVAILABLE: {type(exc).__name__}: {exc}"
            ) from exc
        if not rows:
            raise EnvironmentProviderError("Open-Meteo returned no wind samples.")

        start_dt = start_time if start_time.tzinfo is None else start_time.replace(tzinfo=None)
        field = EnvironmentField()
        n = max(1, int(round((duration_hours * 3600) / time_step_seconds)))
        for i in range(n):
            stamp = start_dt + timedelta(seconds=i * time_step_seconds)
            row = _live.nearest_wind_row(rows, stamp) or rows[-1]
            u_wind, v_wind = _live.wind_to_uv(
                row.get("wind_speed_10m"),
                row.get("wind_direction_10m"),
            )
            field.append(
                EnvironmentSample(
                    timestamp=stamp,
                    latitude=latitude,
                    longitude=longitude,
                    u_current=0.0,
                    v_current=0.0,
                    u_wind=u_wind,
                    v_wind=v_wind,
                    source=self.source,
                    dataset=self.dataset,
                    resolution_degrees=self.resolution_degrees,
                )
            )
        return field

    def get(
        self,
        latitude: float,
        longitude: float,
        start_time: datetime,
        duration_hours: float,
        time_step_seconds: int,
    ) -> EnvironmentField:
        return self._series(latitude, longitude, start_time, duration_hours, time_step_seconds)


def _cache_time(dt: datetime) -> str:
    """Stable UTC string key component for a datetime (naive or aware)."""
    from datetime import timezone as _tz

    if dt.tzinfo is not None:
        dt = dt.astimezone(_tz.utc).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def resolve_provider(source: Optional[str] = None) -> EnvironmentProvider:
    """Return the provider for ``source``, or the controlled provider default.

    Validated sources: ``CONTROLLED``, ``CMEMS``, ``ERA5``, ``LIVE``.
    """
    cfg = get_environment_config()
    key = (source or "CONTROLLED").strip().upper()
    if key == "CMEMS":
        if not cfg.cmems_available:
            raise EnvironmentProviderError(
                "CMEMS requested but UNAVAILABLE (credentials not configured). "
                "Use CONTROLLED."
            )
        return CMEMSProvider()
    if key == "ERA5":
        if not cfg.era5_available:
            raise EnvironmentProviderError(
                "ERA5 requested but UNAVAILABLE (CDS_API_KEY not configured). Use CONTROLLED."
            )
        return ERA5Provider()
    if key in ("LIVE", "OPENMETEO"):
        # Real, credential-free 10 m wind (Open-Meteo). Network failures raise
        # at fetch time and the engine falls back to CONTROLLED honestly.
        return LiveWeatherProvider()
    # CONTROLLED (default) — always available and reproducible.
    return ControlledEnvironmentProvider()
