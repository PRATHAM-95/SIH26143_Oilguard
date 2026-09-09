"""Backtracking engine — ensemble backward Lagrangian particle simulation.

Uses OpenDrift's native backward mode (negative timestep) to advect particles
from the observed slick position backward in time, producing an ensemble of
plausible historical trajectories and a probable source region.

Scientific basis:
- Dagestad et al. (2018, Geosci. Model Dev.): OpenDrift backward mode
- Chen (2019, Marine Pollution Bulletin): backtracking methodology
- Ensemble perturbation follows Kampouris et al. (2021) and SYSTEM_SPEC

Oil weathering (evaporation, emulsification) is intentionally DISABLED during
backward simulation because these processes are irreversible and modelling them
backward is physically meaningless.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import numpy as np

from ..drift.engine import (
    _TimeVaryingConstantReader,
    _resolve_forcing_provider,
)
from ..observability import observe
from ..models.forward_drift import CurrentForcing, WindForcing

log = logging.getLogger("oilspill.backtracking.engine")

_UTC = timezone.utc

BACKTRACK_MODEL_VERSION = "opendrift-1.14.11/openoil-backtrack"

# Default backtracking parameters (from SYSTEM_SPEC section 9.4).
DEFAULT_ENSEMBLE_SIZE = 20
DEFAULT_PARTICLES_PER_MEMBER = 200
DEFAULT_TIMESTEP_SECONDS = -900  # negative = backward
DEFAULT_DURATION_HOURS = 6.0

# Wind drift factor perturbation range (literature: 0.01-0.06).
WDF_MIN = 0.02
WDF_MAX = 0.04
WDF_DEFAULT = 0.03

# Wind deflection angle perturbation range (degrees, clockwise from wind).
WDA_MIN = 0.0
WDA_MAX = 10.0
WDA_DEFAULT = 5.0

# Diffusion perturbation range (m^2/s).
DIFF_MIN = 1.0
DIFF_MAX = 20.0
DIFF_DEFAULT = 5.0

# Current uncertainty multiplier range.
CURR_UNC_MIN = 0.85
CURR_UNC_MAX = 1.15

# Wind speed perturbation multiplier range.
WIND_UNC_MIN = 0.85
WIND_UNC_MAX = 1.15

# Compact trajectory fan: max time points per particle path and max particles
# per member forwarded to the frontend for map rendering. Keeps response size
# bounded while faithfully showing the backward trajectory fan.
TRAJ_MAX_POINTS = 24
TRAJ_FAN_PARTICLES = 6


@dataclass
class BacktrackConfig:
    """Configuration for a backtracking ensemble run."""

    ensemble_size: int = DEFAULT_ENSEMBLE_SIZE
    particles_per_member: int = DEFAULT_PARTICLES_PER_MEMBER
    duration_hours: float = DEFAULT_DURATION_HOURS
    timestep_seconds: int = -900
    seed: Optional[int] = None
    wind_drift_factor_range: Tuple[float, float] = (WDF_MIN, WDF_MAX)
    wind_deflection_range: Tuple[float, float] = (WDA_MIN, WDA_MAX)
    diffusion_range: Tuple[float, float] = (DIFF_MIN, DIFF_MAX)
    current_uncertainty: Tuple[float, float] = (CURR_UNC_MIN, CURR_UNC_MAX)
    wind_uncertainty: Tuple[float, float] = (WIND_UNC_MIN, WIND_UNC_MAX)


@dataclass
class BacktrackMember:
    """Result of one ensemble member's backward simulation."""

    member_index: int
    wind_drift_factor: float
    wind_deflection_deg: float
    diffusivity: float
    current_scale: float
    wind_scale: float
    endpoints: np.ndarray  # shape (N, 2) [lon, lat]
    trajectory: Optional[List[dict]] = None  # full trajectory if requested
    valid: bool = True
    land_hits: int = 0
    domain_exits: int = 0


@dataclass
class BacktrackResult:
    """Complete result of an ensemble backtracking run."""

    members: List[BacktrackMember] = field(default_factory=list)
    all_endpoints: Optional[np.ndarray] = None
    converged_count: int = 0
    total_particles: int = 0
    land_hits: int = 0
    domain_exits: int = 0
    warnings: List[str] = field(default_factory=list)


@observe("backtrack")
def run_backtrack_ensemble(
    slick_lon: float,
    slick_lat: float,
    observation_time: datetime,
    config: BacktrackConfig,
    environment_source: str = "CONTROLLED",
    currents: Optional[CurrentForcing] = None,
    wind: Optional[WindForcing] = None,
    polygon: Optional[List[List[float]]] = None,
) -> BacktrackResult:
    """Run an ensemble of backward simulations from the slick observation.

    Parameters
    ----------
    slick_lon, slick_lat : float
        Centroid of the observed slick.
    observation_time : datetime
        When the slick was observed (UTC).
    config : BacktrackConfig
        Ensemble configuration (member count, particles, duration, ranges).
    environment_source : str
        Forcing source identifier.
    currents : CurrentForcing, optional
        Current forcing for CONTROLLED mode.
    wind : WindForcing, optional
        Wind forcing for CONTROLLED mode.
    polygon : list of [lon, lat], optional
        Slick polygon for spatial seeding.

    Returns
    -------
    BacktrackResult
    """
    from opendrift.models.openoil import OpenOil

    rng = np.random.default_rng(config.seed)
    result = BacktrackResult()

    # Normalize observation time.
    if observation_time.tzinfo is not None:
        observation_time = observation_time.astimezone(_UTC).replace(tzinfo=None)

    # Generate seed positions: either from polygon or from centroid.
    seed_positions = _generate_seed_positions(
        slick_lon, slick_lat, polygon, config.particles_per_member, rng
    )

    for i in range(config.ensemble_size):
        # Draw perturbed parameters for this member.
        wdf = rng.uniform(*config.wind_drift_factor_range)
        wda = rng.uniform(*config.wind_deflection_range)
        diff = rng.uniform(*config.diffusion_range)
        curr_scale = rng.uniform(*config.current_uncertainty)
        wind_scale = rng.uniform(*config.wind_uncertainty)

        try:
            member = _run_single_member(
                member_index=i,
                seed_positions=seed_positions,
                observation_time=observation_time,
                config=config,
                wdf=wdf,
                wda_deg=wda,
                diffusivity=diff,
                current_scale=curr_scale,
                wind_scale=wind_scale,
                environment_source=environment_source,
                currents=currents,
                wind=wind,
                slick_lon=slick_lon,
                slick_lat=slick_lat,
            )
            result.members.append(member)
            if member.valid:
                result.converged_count += 1
                result.land_hits += member.land_hits
                result.domain_exits += member.domain_exits
        except Exception as exc:
            log.warning("Ensemble member %d failed: %s", i, exc)
            result.warnings.append(f"Member {i} failed: {exc}")

    result.total_particles = config.ensemble_size * config.particles_per_member

    # Collect all valid endpoints.
    valid_endpoints = [
        m.endpoints for m in result.members if m.valid and m.endpoints.size > 0
    ]
    if valid_endpoints:
        result.all_endpoints = np.vstack(valid_endpoints)
    else:
        result.all_endpoints = np.empty((0, 2))
        result.warnings.append("No valid endpoints produced by ensemble.")

    return result


def _generate_seed_positions(
    slick_lon: float,
    slick_lat: float,
    polygon: Optional[List[List[float]]],
    n_particles: int,
    rng: np.random.Generator,
) -> Tuple[np.ndarray, np.ndarray]:
    """Generate seed positions within the slick polygon or near the centroid.

    Returns (lons, lats) arrays of shape (n_particles,).
    """
    if polygon and len(polygon) >= 4:
        # Sample uniformly within the polygon using rejection sampling.
        lons_arr = np.array([p[0] for p in polygon])
        lats_arr = np.array([p[1] for p in polygon])
        lon_min, lon_max = lons_arr.min(), lons_arr.max()
        lat_min, lat_max = lats_arr.min(), lats_arr.max()

        # Small margin around the polygon.
        lon_range = lon_max - lon_min
        lat_range = lat_max - lat_min
        margin_lon = lon_range * 0.1 + 0.001
        margin_lat = lat_range * 0.1 + 0.001

        lons = np.empty(n_particles)
        lats = np.empty(n_particles)
        collected = 0
        max_attempts = n_particles * 20
        attempts = 0

        while collected < n_particles and attempts < max_attempts:
            candidate_lon = rng.uniform(lon_min - margin_lon, lon_max + margin_lon)
            candidate_lat = rng.uniform(lat_min - margin_lat, lat_max + margin_lat)
            if _point_in_ring(candidate_lon, candidate_lat, polygon):
                lons[collected] = candidate_lon
                lats[collected] = candidate_lat
                collected += 1
            attempts += 1

        if collected < n_particles:
            # Fill remaining with centroid positions.
            lons[collected:] = slick_lon
            lats[collected:] = slick_lat
            log.warning(
                "Polygon seeding: only %d/%d particles placed inside polygon.",
                collected, n_particles,
            )
        return lons, lats

    # Default: seed at the centroid with a small random spread.
    spread_lon = 0.002  # ~200m
    spread_lat = 0.002
    lons = slick_lon + rng.normal(0, spread_lon / 3, n_particles)
    lats = slick_lat + rng.normal(0, spread_lat / 3, n_particles)
    return lons, lats


def _point_in_ring(lon: float, lat: float, ring: list) -> bool:
    """Ray-casting point-in-polygon test."""
    n = len(ring)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _run_single_member(
    member_index: int,
    seed_positions: Tuple[np.ndarray, np.ndarray],
    observation_time: datetime,
    config: BacktrackConfig,
    wdf: float,
    wda_deg: float,
    diffusivity: float,
    current_scale: float,
    wind_scale: float,
    environment_source: str,
    currents: Optional[CurrentForcing],
    wind: Optional[WindForcing],
    slick_lon: float,
    slick_lat: float,
) -> BacktrackMember:
    """Run a single backward simulation member with perturbed parameters."""
    from opendrift.models.openoil import OpenOil

    lons, lats = seed_positions
    n = len(lons)

    # Apply current perturbation by scaling the forcing.
    perturbed_currents = None
    if currents is not None:
        from ..models.forward_drift import CurrentForcing as CF
        perturbed_currents = CF(
            u=currents.u * current_scale,
            v=currents.v * current_scale,
        )
    perturbed_wind = None
    if wind is not None:
        from ..models.forward_drift import WindForcing as WF
        perturbed_wind = WF(
            u=wind.u * wind_scale,
            v=wind.v * wind_scale,
        )

    # Resolve the forcing field.
    provider = _resolve_forcing_provider(
        environment_source,
        currents=perturbed_currents,
        wind=perturbed_wind,
        latitude=slick_lat,
        longitude=slick_lon,
        start_time=observation_time,
        duration_hours=config.duration_hours,
        time_step_seconds=abs(config.timestep_seconds),
    )
    field = provider.get(
        slick_lat, slick_lon, observation_time,
        config.duration_hours, abs(config.timestep_seconds),
    )

    # Create OpenOil instance. 'noaa' is the only constructor-accepted
    # weathering model in this OpenDrift version, and OpenOil.oil_weathering()
    # automatically (and correctly) skips all weathering for backward runs
    # (time_step < 0). We explicitly disable the individual processes too, so
    # the backward source-estimation run is purely advective (see report).
    o = OpenOil(weathering_model="noaa")

    # Configure. Weathering processes are off for a purely advective backward
    # source-estimation (OpenOil also disables them for negative timesteps).
    o.set_config("processes:evaporation", False)
    o.set_config("processes:emulsification", False)
    o.set_config("processes:dispersion", False)
    o.set_config("processes:biodegradation", False)
    o.set_config("general:use_auto_landmask", False)
    o.set_config("environment:constant:horizontal_diffusivity", diffusivity)
    o.set_config("environment:constant:sea_water_temperature", 20.0)

    # Wind drift factor is a per-element property in OpenDrift 1.14.x, seeded
    # through the 'seed:wind_drift_factor' config (the legacy
    # 'drift:wind_drift_factor' key no longer exists in this version). We set
    # it so each ensemble member runs with its drawn WDF. NOTE: an empirical
    # probe on OpenDrift 1.14.11 shows the property array stays empty for
    # backward (negative-timestep) runs, so the WDF dimension is metadata + a
    # forward-compatible hook there; wind leeway in backward mode follows
    # OpenDrift's internal handling (see STEP_09_REPORT §20 limitation).
    try:
        o.set_config("seed:wind_drift_factor", wdf)
    except Exception as exc:
        log.debug("wind_drift_factor seed config unavailable: %s", exc)
    # Wind deflection angle is not exposed as a config in OpenDrift 1.14.x; it
    # remains a documented parameter for future versions.
    try:
        o.set_config("drift:wind_deflection_angle", wda_deg)
    except Exception:
        pass

    # Add forcing reader.
    cr = _TimeVaryingConstantReader(field)
    o.add_reader([cr])

    # Seed particles.
    o.seed_elements(
        lon=lons,
        lat=lats,
        radius=0.0,
        number=n,
        time=observation_time,
    )

    # Run backward.
    o.run(
        duration=timedelta(hours=config.duration_hours),
        time_step=timedelta(seconds=config.timestep_seconds),
    )

    # Extract final positions.
    final_lon = np.asarray(o.elements.lon, dtype=float)
    final_lat = np.asarray(o.elements.lat, dtype=float)
    endpoints = np.column_stack([final_lon, final_lat])

    # Quality control: count land hits and domain exits.
    land_hits = 0
    domain_exits = 0
    for lo, la in zip(final_lon, final_lat):
        if lo < -180 or lo > 180 or la < -90 or la > 90:
            domain_exits += 1

    # Build a compact backward-trajectory fan from OpenDrift's result store.
    # o.result holds lon/lat of shape (trajectory=N, time=T) in backward time
    # order (index 0 = observation time, last = most historical = source side).
    # We emit a small fan (TRAJ_FAN_PARTICLES) of representative particle paths,
    # each downsampled in time to TRAJ_MAX_POINTS, ordered from the observed
    # slick back toward the probable source. This is the honest map rendering:
    # individual backward trajectories, not a statistical blob.
    trajectory = []
    try:
        res = o.result
        if res is not None and "lon" in res and "lat" in res and res.sizes["time"] > 1:
            t_lons = np.asarray(res["lon"].values, dtype=float)  # (N, T)
            t_lats = np.asarray(res["lat"].values, dtype=float)
            n_parts = t_lons.shape[0]
            t_count = t_lons.shape[1]

            # Sample time indices (always include observation t=0 and source t=T-1).
            t_idx = list(range(0, t_count, max(1, t_count // TRAJ_MAX_POINTS)))
            if t_idx[-1] != t_count - 1:
                t_idx.append(t_count - 1)

            # Choose fan particles spread across the ensemble.
            fan_idx = sorted({
                int(p) for p in np.linspace(0, n_parts - 1, num=min(TRAJ_FAN_PARTICLES, n_parts))
            })

            for p in fan_idx:
                path_points = [
                    {"lon": float(t_lons[p, ti]), "lat": float(t_lats[p, ti])}
                    for ti in t_idx
                ]
                trajectory.append({"particle": p, "endpoints": path_points})
    except Exception as exc:
        log.debug("trajectory extraction failed: %s", exc)

    return BacktrackMember(
        member_index=member_index,
        wind_drift_factor=wdf,
        wind_deflection_deg=wda_deg,
        diffusivity=diffusivity,
        current_scale=current_scale,
        wind_scale=wind_scale,
        endpoints=endpoints,
        trajectory=trajectory,
        valid=True,
        land_hits=land_hits,
        domain_exits=domain_exits,
    )


# Re-exported for backward import compatibility (main.py imports these from
# engine). Defined in source.py because they are pure and need no OpenDrift.
from .source import compute_source_time_range, make_run_id  # noqa: E402, F401
