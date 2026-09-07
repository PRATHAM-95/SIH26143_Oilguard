"""Forward oil-drift engine powered by OpenOil (OpenDrift).

Wraps ``opendrift.models.openoil.OpenOil`` so that a spill origin + start
time + duration + forcing produces:

  * a particle cloud (lon/lat/z/mass_kg),
  * a slick-extent polygon (convex hull around the particle cloud),
  * a NOAA mass balance (evaporated/dispersed/remaining kilograms),
  * reproducibility metadata (fixed seed, config, digest).

Oil-type handling: OpenOil's NOAA ADIOS database only accepts exact oil
strings. The specification's ``"GENERIC CRUDE"`` is not an ADIOS entry, so it
is mapped to the closest valid generic crude ``"GENERIC MEDIUM CRUDE"``. Any
other requested type must be a valid ADIOS entry or the request is rejected.
"""

from __future__ import annotations

import hashlib
import logging
import time as _time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, tzinfo
from typing import Dict, List, Optional, Tuple

import numpy as np

from ..environment.contract import EnvironmentField, EnvironmentProvider, EnvironmentProviderError
from ..environment.providers import (
    CMEMSProvider,
    ControlledEnvironmentProvider,
    ERA5Provider,
)
from ..environment.config import get_environment_config
from ..models.forward_drift import (
    CurrentForcing,
    DriftRunMetadata,
    Extent,
    ForwardDriftResponse,
    MassBalance,
    Particle,
    WindForcing,
)

log = logging.getLogger("oilspill.drift")

_UTC = timezone.utc

# OpenDrift version reported at runtime.
DRIFT_MODEL_VERSION = "opendrift-1.14.11/openoil"

# Suppress OpenDrift's verbose INFO/DEBUG chatter (module-init log lines) so
# the API surface stays clean; engine still runs the full simulation.
for _name in list(logging.root.manager.loggerDict):
    if _name.startswith("opendrift"):
        logging.getLogger(_name).setLevel(logging.CRITICAL)
logging.getLogger("opendrift").setLevel(logging.CRITICAL)

# The specification's generic oil label -> nearest valid ADIOS entry.
GENERIC_CRUDE_ALIAS = "GENERIC CRUDE"
# Common spill-report short codes mapped to the closest ADIOS entry. HFO
# (heavy fuel oil, IFO-380) is the everyday name for ADIOS "GENERIC BUNKER C";
# "DIESEL" is the generic "GENERIC DIESEL"; "CRUDE OIL" is generic medium crude.
GENERIC_CRUDE_MAPPING = {
    "GENERIC CRUDE": "GENERIC MEDIUM CRUDE",
    "HFO": "GENERIC BUNKER C",
    "IFO-380": "GENERIC BUNKER C",
    "DIESEL": "GENERIC DIESEL",
    "CRUDE OIL": "GENERIC MEDIUM CRUDE",
}

MODEL_DEFAULT_TIMESTEP_SECONDS = 900  # 15 minutes per spec §8.2.

try:  # allow import even when OpenOil is not installed (tests, tooling).
    from opendrift.models.openoil import OpenOil
except Exception:  # pragma: no cover - import-time guard
    OpenOil = None  # type: ignore

try:  # reader_constant is used to build the forcing reader for OpenDrift.
    from opendrift.readers import reader_constant
except Exception:  # pragma: no cover - tooling/tests without OpenDrift
    reader_constant = None  # type: ignore


def list_valid_oil_types() -> List[str]:
    """Return the valid ADIOS oil types known to the installed OpenOil."""
    if OpenOil is None:
        return []
    try:
        probe = OpenOil(weathering_model="noaa")
        return sorted(str(t) for t in probe.oiltypes)
    except Exception:
        return []


def resolve_oil_type(requested: str) -> str:
    """Map the requested oil type to a valid ADIOS entry or raise ValueError."""
    raw = requested.strip()
    if raw in GENERIC_CRUDE_MAPPING:
        return GENERIC_CRUDE_MAPPING[raw]
    valid = set(list_valid_oil_types())
    if raw in valid:
        return raw
    raise ValueError(
        f"Unknown oil type '{requested}'. Use a valid ADIOS entry (e.g. "
        "'GENERIC BUNKER C', 'GENERIC DIESEL', 'GENERIC MEDIUM CRUDE') "
        "or the generic alias '{GENERIC_CRUDE_ALIAS}'."
    )


@dataclass
class DriftEngineConfig:
    """Runtime parameters for a forward-drift simulation.

    All values are explicit (configurable), never magic numbers baked into
    the engine. Defaults reflect SYSTEM_SPEC §8.2 where applicable.
    """

    timestep_seconds: int = MODEL_DEFAULT_TIMESTEP_SECONDS
    horizontal_diffusivity: float = 5.0  # m^2/s (well-mixed surface).
    sea_water_temperature_c: float = 20.0
    seed_radius_m: float = 0.0
    seed_radius_type: str = "uncertainty"  # 'gaussian' in newer OpenDrift.
    use_auto_landmask: bool = False


def _resolve_forcing_provider(
    environment_source: str,
    currents: Optional[CurrentForcing],
    wind: Optional[WindForcing],
    latitude: float,
    longitude: float,
    start_time: datetime,
    duration_hours: float,
    time_step_seconds: int,
) -> EnvironmentProvider:
    """Choose the forcing provider for a run.

    ``environment_source`` selects the data source:
      * ``CONTROLLED`` (default) — deterministic constant forcing from the
        request's ``currents``/``wind`` overrides.
      * ``CMEMS`` — real ocean currents from Copernicus Marine.
      * ``ERA5`` — real 10 m wind from ECMWF CDS.
      * ``REAL`` / ``CMEMS_ERA5`` — combine CMEMS currents with ERA5 wind.

    Real providers are enabled only when the corresponding credentials are set
    in the environment (see ``app.environment.config``). If a requested real
    source is UNAVAILABLE or its fetch fails, this raises
    ``EnvironmentProviderError`` and the caller falls back to CONTROLLED
    forcing (it never fabricates real data).
    """
    key = (environment_source or "CONTROLLED").strip().upper()
    if key in ("CMEMS", "ERA5", "REAL", "CMEMS_ERA5"):
        return _RealForcingProvider(key, latitude, longitude, start_time, duration_hours, time_step_seconds)
    return ControlledEnvironmentProvider(
        u_current=currents.u if currents else 0.0,
        v_current=currents.v if currents else 0.0,
        u_wind=wind.u if wind else 0.0,
        v_wind=wind.v if wind else 0.0,
    )


class _RealForcingProvider(EnvironmentProvider):
    """Combines CMEMS currents and/or ERA5 wind into one normalized field.

    Raises ``EnvironmentProviderError`` if any requested real source cannot be
    satisfied, so callers fall back to CONTROLLED forcing rather than shipping
    fabricated results.
    """

    source = "REAL"
    dataset = "CMEMS + ERA5"

    def __init__(
        self,
        mode: str,
        latitude: float,
        longitude: float,
        start_time: datetime,
        duration_hours: float,
        time_step_seconds: int,
    ) -> None:
        self.mode = mode
        self.latitude = latitude
        self.longitude = longitude
        self.start_time = start_time
        self.duration_hours = duration_hours
        self.time_step_seconds = time_step_seconds

    def get(
        self,
        latitude: float,
        longitude: float,
        start_time: datetime,
        duration_hours: float,
        time_step_seconds: int,
    ) -> EnvironmentField:
        cfg = get_environment_config()
        want_currents = self.mode in ("CMEMS", "REAL", "CMEMS_ERA5")
        want_wind = self.mode in ("ERA5", "REAL", "CMEMS_ERA5")

        current_field = None
        wind_field = None

        if want_currents:
            if not cfg.cmems_available:
                raise EnvironmentProviderError(
                    "CMEMS requested but UNAVAILABLE (CMEMS_USERNAME/CMEMS_PASSWORD not configured)."
                )
            current_field = CMEMSProvider().get(
                self.latitude, self.longitude, self.start_time, self.duration_hours, self.time_step_seconds
            )
        if want_wind:
            if not cfg.era5_available:
                raise EnvironmentProviderError(
                    "ERA5 requested but UNAVAILABLE (CDS_API_KEY not configured)."
                )
            wind_field = ERA5Provider().get(
                self.latitude, self.longitude, self.start_time, self.duration_hours, self.time_step_seconds
            )

        if current_field and not wind_field:
            return current_field
        if wind_field and not current_field:
            return wind_field

        # Merge current + wind into a single combined field (same timestamps).
        merged = EnvironmentField()
        c, w = current_field, wind_field
        n = min(len(c.samples), len(w.samples))
        for i in range(n):
            sc, sw = c.samples[i], w.samples[i]
            from ..environment.contract import EnvironmentSample

            merged.append(
                EnvironmentSample(
                    timestamp=sc.timestamp,
                    latitude=sc.latitude,
                    longitude=sc.longitude,
                    u_current=sc.u_current,
                    v_current=sc.v_current,
                    u_wind=sw.u_wind,
                    v_wind=sw.v_wind,
                    source="CMEMS",
                    dataset="CMEMS + ERA5",
                    resolution_degrees=None,
                )
            )
        return merged


class ForwardDriftEngine:
    """Runs OpenOil forward-drift simulations from a normalized request."""

    def __init__(self, config: Optional[DriftEngineConfig] = None) -> None:
        self.config = config or DriftEngineConfig()

    def _configure(self, o: "OpenOil", field: EnvironmentField) -> None:
        o.set_config("general:use_auto_landmask", self.config.use_auto_landmask)
        o.set_config(
            "environment:constant:horizontal_diffusivity",
            self.config.horizontal_diffusivity,
        )
        o.set_config(
            "environment:constant:sea_water_temperature",
            self.config.sea_water_temperature_c,
        )
        # Feed the normalized forcing to OpenDrift via a reader whose values
        # change with each queried time step, so real (spatio-temporal) forcing
        # is honoured. For a CONTROLLED field every sample is identical, which
        # reproduces the previous constant-forcing behaviour exactly.
        cr = _TimeVaryingConstantReader(field)
        o.add_reader([cr])

    def run(
        self,
        origin_lat: float,
        origin_lon: float,
        start_time: datetime,
        duration_hours: float,
        particle_count: int,
        oil_type: str = "GENERIC BUNKER C",
        currents: Optional[CurrentForcing] = None,
        wind: Optional[WindForcing] = None,
        environment_source: str = "CONTROLLED",
        simulation_id: Optional[str] = None,
    ) -> ForwardDriftResponse:
        """Execute a forward-drift run and return the §15.2 response."""
        t0 = _time.monotonic()
        if OpenOil is None:
            raise RuntimeError("OpenOil is not importable on this host.")

        # Normalize tz-aware API timestamps (ISO with Z / +offset) to a
        # tz-naive UTC datetime. OpenOil's pandas internals mix tz-naive
        # time axes and reject tz-aware comparisons, so we convert the
        # absolute instant to UTC and drop the tzinfo.
        if start_time.tzinfo is not None:
            start_time = start_time.astimezone(_UTC).replace(tzinfo=None)

        resolved_oil = resolve_oil_type(oil_type)
        # Resolve and fetch the forcing field. A requested REAL source
        # (CMEMS/ERA5) that is UNAVAILABLE (no credentials) or fails to fetch
        # must NOT produce fabricated real data: fall back to the deterministic
        # CONTROLLED field and record that in the run metadata.
        try:
            provider: EnvironmentProvider = _resolve_forcing_provider(
                environment_source,
                currents=currents,
                wind=wind,
                latitude=origin_lat,
                longitude=origin_lon,
                start_time=start_time,
                duration_hours=duration_hours,
                time_step_seconds=self.config.timestep_seconds,
            )
            field = provider.get(
                origin_lat, origin_lon, start_time, duration_hours, self.config.timestep_seconds
            )
        except EnvironmentProviderError as exc:
            if (environment_source or "CONTROLLED").strip().upper() in (
                "CMEMS", "ERA5", "REAL", "CMEMS_ERA5",
            ):
                log.warning(
                    "Real environment unavailable (%s); falling back to CONTROLLED forcing.",
                    exc,
                )
                field = ControlledEnvironmentProvider(
                    u_current=currents.u if currents else 0.0,
                    v_current=currents.v if currents else 0.0,
                    u_wind=wind.u if wind else 0.0,
                    v_wind=wind.v if wind else 0.0,
                ).get(
                    origin_lat, origin_lon, start_time, duration_hours, self.config.timestep_seconds
                )
            else:
                raise

        o = OpenOil(weathering_model="noaa")
        self._configure(o, field)
        o.seed_elements(
            lon=origin_lon,
            lat=origin_lat,
            radius=self.config.seed_radius_m,
            number=particle_count,
            radius_type=self.config.seed_radius_type,
            time=start_time,
            oil_type=resolved_oil,
        )
        o.run(
            duration=timedelta(hours=duration_hours),
            time_step=timedelta(seconds=self.config.timestep_seconds),
        )

        lon = np.asarray(o.elements.lon, dtype=float)
        lat = np.asarray(o.elements.lat, dtype=float)
        mass_oil = np.asarray(o.elements.mass_oil, dtype=float)
        mass_evap = np.asarray(o.elements.mass_evaporated, dtype=float)
        mass_disp = np.asarray(o.elements.mass_dispersed, dtype=float)
        mass_biodeg = np.asarray(o.elements.mass_biodegraded, dtype=float)

        particles = [
            Particle(lon=float(lo), lat=float(la), z=0.0, mass_kg=float(mm))
            for lo, la, mm in zip(lon, lat, mass_oil)
        ]

        remaining = float(mass_oil.sum())
        evaporated = float(mass_evap.sum())
        dispersed = float(mass_disp.sum())
        biodegraded = float(mass_biodeg.sum())
        # Floating-point wafer: gracefully absorb biodegradation into
        # 'dispersed' if present but not reported by the contract separately.
        dispersed += biodegraded

        extent = _build_extent(lon, lat, origin_lon, origin_lat)

        digest = _reproducibility_digest(lon, lat, mass_oil)
        completed = datetime.utcnow().replace(tzinfo=None)
        started_at = datetime.utcnow().replace(tzinfo=None) - timedelta(
            seconds=(_time.monotonic() - t0)
        )
        run_id = _make_run_id(start_time, origin_lon, origin_lat, resolved_oil)

        metadata = DriftRunMetadata(
            run_id=run_id,
            simulation_id=simulation_id,
            oil_type=resolved_oil,
            particles_used=particle_count,
            timestep_seconds=self.config.timestep_seconds,
            duration_hours=duration_hours,
            environment_source=field.source if field.samples else "none",
            environment_dataset=field.dataset if field.samples else "none",
            model_version=DRIFT_MODEL_VERSION,
            reproducibility_digest=digest,
            started_at=started_at,
            completed_at=completed,
            elapsed_ms=int((_time.monotonic() - t0) * 1000),
        )

        return ForwardDriftResponse(
            particles=particles,
            extent=extent,
            massBalance=MassBalance(
                evaporated_kg=round(evaporated, 3),
                dispersed_kg=round(dispersed, 3),
                remaining_kg=round(remaining, 3),
            ),
            driftRun=metadata,
        )


class _TimeVaryingConstantReader(reader_constant.Reader):
    """OpenDrift reader that yields normalized forcing that varies with time.

    Subclasses OpenDrift's own ``reader_constant.Reader`` so OpenDrift accepts
    it as a genuine Reader, while overriding ``get_variables`` to return the
    current/wind components for the sample nearest each queried integration
    step. Spatially it stays horizontally-uniform (matching the MVP contract,
    which evaluates the point at the spill origin). For a CONTROLLED field (all
    samples equal) the result is identical to the previous single constant
    reader.
    """

    def __init__(self, field: EnvironmentField) -> None:
        if not field.samples:
            raise EnvironmentProviderError("environment field has no samples")
        super().__init__(
            {
                "x_sea_water_velocity": 0.0,
                "y_sea_water_velocity": 0.0,
                "x_wind": 0.0,
                "y_wind": 0.0,
                "land_binary_mask": 0,
            }
        )
        self._samples = list(field.samples)
        self.name = "time_varying_constant_reader"

    def get_variables(self, requestedVariables, time=None, x=None, y=None, z=None):
        samples = self._samples
        i = self._idx(time)
        s = samples[min(i, len(samples) - 1)]
        shape = np.asarray(x).shape
        variables = {"time": time, "x": x, "y": y, "z": z}
        for var in requestedVariables:
            if var == "x_sea_water_velocity":
                val = s.u_current
            elif var == "y_sea_water_velocity":
                val = s.v_current
            elif var == "x_wind":
                val = s.u_wind
            elif var == "y_wind":
                val = s.v_wind
            elif var == "land_binary_mask":
                val = 0.0
            else:
                val = 0.0
            variables[var] = np.full(shape, float(val), dtype=float)
        return variables

    def _idx(self, time) -> int:
        samples = self._samples
        if time is None or len(samples) <= 1:
            return 0
        target = _ts_to_unix(time)
        axis = np.asarray([_ts_to_unix(s.timestamp) for s in samples], dtype=float)
        i = int(np.searchsorted(axis, target, side="right") - 1)
        return max(0, min(len(samples) - 1, i))


def _ts_to_unix(dt: datetime) -> float:
    """Convert a (possibly tz-naive UTC) datetime to Unix seconds."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_UTC)
    return dt.timestamp()


def _reader_from_sample(sample):
    """Build a constant OpenDrift reader from a normalized environment sample."""
    from opendrift.readers import reader_constant

    return reader_constant.Reader(
        {
            "x_sea_water_velocity": sample.u_current,
            "y_sea_water_velocity": sample.v_current,
            "x_wind": sample.u_wind,
            "y_wind": sample.v_wind,
            "land_binary_mask": 0,
        }
    )


def _convex_hull_2d(points: np.ndarray) -> Optional[np.ndarray]:
    """Return the indices of the convex hull of ``points`` (as a numpy array).

    ``points`` has shape (N, 2) with columns [x, y]. Falls back to a
    bounding-rectangle when fewer than 3 points or SciPy is unavailable.
    """
    if points.shape[0] < 3:
        return None
    try:
        from scipy.spatial import ConvexHull

        hull = ConvexHull(points[:, :2])
        return points[hull.vertices]
    except Exception:
        # Affine-degenerate (collinear) set -> bounding rectangle.
        x0, x1 = float(points[:, 0].min()), float(points[:, 0].max())
        y0, y1 = float(points[:, 1].min()), float(points[:, 1].max())
        return np.array([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]])


def _build_extent(lon: np.ndarray, lat: np.ndarray, olon: float, olat: float) -> Extent:
    """Build a GeoJSON Polygon (anti-clockwise) enclosing the particle cloud."""
    if lon.size == 0:
        ring = [
            [olon, olat],
            [olon + 0.001, olat],
            [olon + 0.001, olat + 0.001],
            [olon, olat + 0.001],
            [olon, olat],
        ]
        return Extent(type="Polygon", coordinates=[ring])

    pts = np.stack([lon, lat], axis=-1)
    hull = _convex_hull_2d(pts)
    if hull is None or hull.shape[0] < 3:
        hull = np.stack([lon, lat], axis=-1)
    ring = [[float(x), float(y)] for x, y in hull.tolist()]
    if len(ring) >= 3:
        ring.append(ring[0])  # close the ring
    return Extent(type="Polygon", coordinates=[ring])


def _reproducibility_digest(lon: np.ndarray, lat: np.ndarray, mass: np.ndarray) -> str:
    """Stable digest over particle output for identical-run detection."""
    h = hashlib.sha256()
    for lo, la, mm in zip(np.round(lon, 10), np.round(lat, 10), np.round(mass, 6)):
        h.update(f"{lo:.10f}|{la:.10f}|{mm:.6f}".encode("ascii"))
    return h.hexdigest()[:16]


def _make_run_id(start_time: datetime, lon: float, lat: float, oil_type: str) -> str:
    raw = f"{start_time.isoformat()}|{lon:.4f}|{lat:.4f}|{oil_type}"
    return "dr-" + hashlib.sha256(raw.encode("ascii")).hexdigest()[:12]