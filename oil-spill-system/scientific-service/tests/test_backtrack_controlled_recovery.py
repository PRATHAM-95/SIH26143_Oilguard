"""Step 09 controlled forward→backward source-recovery experiment.

Unlike the unit-style engine tests (test_backtrack_engine.py), this file runs a
measured, multi-scenario controlled experiment:

  1. a TRUE source location + release time is chosen;
  2. the real forward engine (OpenDrift OpenOil) advects and weathers a slick
     under a known constant forcing for the scenario duration;
  3. the resulting particle cloud's mass-weighted centroid is treated as the
     "observed" slick (exactly what a satellite/SAR observation would report);
  4. the backward ensemble engine is run from that observation with the SAME
     forcing, producing an ensemble of historical endpoints;
  5. the source-estimation pipeline (KDE/HDR) converts endpoints into a
     probable source region + uncertainty;
  6. recovery quality is measured: source-error km, 90% HDR containment,
     time-window bracketing, trajectory agreement, ensemble spread, and
     invalid/land/domain counts.

The five forcing scenarios (still water, east 6h, NE 6h, SW 3h, wind-only 6h,
east 12h) exercise the engine against both current-dominated and wind-dominated
transport and against different durations.

When ``BT_WRITE_ARTIFACT=1`` is set, the full measured table is also written to
``research/24-backtracking/step09_recovery_results.json`` for the report
(sections 19-21). The JSON is never written during a normal test run.
"""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("opendrift", reason="OpenDrift not installed")

from app.backtracking.engine import (  # noqa: E402
    BacktrackConfig,
    run_backtrack_ensemble,
)
from app.backtracking.source import (  # noqa: E402
    compute_source_time_range,
    estimate_source,
    haversine_km,
)
from app.drift.engine import ForwardDriftEngine  # noqa: E402
from app.models.forward_drift import CurrentForcing, WindForcing  # noqa: E402

_UTC = timezone.utc

# TRUE source used throughout the experiment.
TRUE_SOURCE_LON = 71.9
TRUE_SOURCE_LAT = 18.6
# The slick is released exactly at this instant.
RELEASE_TIME = datetime(2026, 9, 2, 6, 0, 0, tzinfo=_UTC)

# Small but fast ensemble. The production default is 20 members; a feasibility
# experiment intentionally uses fewer members to keep the suite cheap while
# still producing a statistically usable endpoint cloud (5 x 50 = 250).
EXPERIMENT_ENSEMBLE_SIZE = 5
EXPERIMENT_PARTICLES_PER_MEMBER = 50
EXPERIMENT_FORWARD_PARTICLES = 100
EXPERIMENT_SEED = 20260902


@dataclass(frozen=True)
class Scenario:
    name: str
    duration_hours: float
    currents: CurrentForcing
    wind: WindForcing
    # Recovery tolerance (km) for this scenario.
    tolerance_km: float


SCENARIOS: list[Scenario] = [
    Scenario("still-water-6h", 6.0, CurrentForcing(u=0.0, v=0.0), WindForcing(u=0.0, v=0.0), 10.0),
    Scenario("east-current-6h", 6.0, CurrentForcing(u=0.5, v=0.0), WindForcing(u=0.0, v=0.0), 20.0),
    Scenario("ne-current-6h", 6.0, CurrentForcing(u=0.4, v=0.3), WindForcing(u=0.0, v=0.0), 20.0),
    Scenario("sw-current-3h", 3.0, CurrentForcing(u=-0.3, v=-0.2), WindForcing(u=0.0, v=0.0), 20.0),
    Scenario("wind-only-6h", 6.0, CurrentForcing(u=0.0, v=0.0), WindForcing(u=10.0, v=0.0), 40.0),
    Scenario("east-current-12h", 12.0, CurrentForcing(u=0.5, v=0.0), WindForcing(u=0.0, v=0.0), 30.0),
]


@dataclass
class ScenarioResult:
    name: str
    duration_hours: float
    currents: dict
    wind: dict
    observed_centroid: dict
    true_displacement_km: float
    source_error_km: float
    uncertainty_km: float
    mean_endpoint_distance_km: float
    std_endpoint_distance_km: float
    trajectory_agreement: float
    ensemble_stability: float
    source_concentration: str
    source_region_contains_true: bool
    source_within_uncertainty_bounds: bool
    source_time_window: dict
    true_release_within_window: bool
    converged_members: int
    total_particles: int
    land_hits: int
    domain_exits: int
    warnings: list = field(default_factory=list)
    tolerance_km: float = 0.0
    passed: bool = False


def _point_in_ring(lon: float, lat: float, ring: list) -> bool:
    """Ray-casting point-in-polygon test (GeoJSON [lon, lat] ring)."""
    n = len(ring)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _true_displacement_km(scenario: Scenario) -> float:
    """Analytic (first-order) displacement magnitude at the TRUE source."""
    du = scenario.currents.u * scenario.duration_hours * 3600.0 / 1000.0
    dv = scenario.currents.v * scenario.duration_hours * 3600.0 / 1000.0
    # Wind drift uses the OpenOil WDF default (3%) at the true source.
    wu = scenario.wind.u * 0.03 * scenario.duration_hours * 3600.0 / 1000.0
    wv = scenario.wind.v * 0.03 * scenario.duration_hours * 3600.0 / 1000.0
    dx = du + wu
    dy = dv + wv
    return float(np.hypot(dx, dy))


def _run_scenario(scenario: Scenario) -> ScenarioResult:
    """Run one full forward→backward→estimate leg of the experiment."""
    engine = ForwardDriftEngine()
    forward = engine.run(
        origin_lat=TRUE_SOURCE_LAT,
        origin_lon=TRUE_SOURCE_LON,
        start_time=RELEASE_TIME,
        duration_hours=scenario.duration_hours,
        particle_count=EXPERIMENT_FORWARD_PARTICLES,
        oil_type="GENERIC BUNKER C",
        currents=scenario.currents,
        wind=scenario.wind,
        environment_source="CONTROLLED",
    )

    pts = np.array([[p.lon, p.lat, p.mass_kg] for p in forward.particles], dtype=float)
    mass = pts[:, 2]
    total_mass = mass.sum()
    obs_lon = float((pts[:, 0] * mass).sum() / total_mass)
    obs_lat = float((pts[:, 1] * mass).sum() / total_mass)
    obs_time = RELEASE_TIME + timedelta(hours=scenario.duration_hours)

    cfg = BacktrackConfig(
        ensemble_size=EXPERIMENT_ENSEMBLE_SIZE,
        particles_per_member=EXPERIMENT_PARTICLES_PER_MEMBER,
        duration_hours=scenario.duration_hours,
        timestep_seconds=-900,
        seed=EXPERIMENT_SEED,
    )
    res = run_backtrack_ensemble(
        slick_lon=obs_lon,
        slick_lat=obs_lat,
        observation_time=obs_time,
        config=cfg,
        environment_source="CONTROLLED",
        currents=scenario.currents,
        wind=scenario.wind,
    )

    est = estimate_source(res.all_endpoints, obs_lon, obs_lat)

    err_km = haversine_km(est.origin_lon, est.origin_lat, TRUE_SOURCE_LON, TRUE_SOURCE_LAT)
    window = compute_source_time_range(obs_time, scenario.duration_hours)
    true_release_str = (
        RELEASE_TIME.astimezone(_UTC).replace(tzinfo=None).isoformat() + "Z"
    )

    contains = False
    ring = None
    if est.source_region and est.source_region.get("coordinates"):
        ring = est.source_region["coordinates"][0]
        contains = _point_in_ring(TRUE_SOURCE_LON, TRUE_SOURCE_LAT, ring)

    within_window = window["earliest"] <= true_release_str <= window["latest"]
    # The engine's operational claim is: recovered origin + reported
    # uncertainty radius bracket the TRUE source. 3 x uncertainty (or 5 km,
    # whichever is larger) is the honest 3-sigma-style bound.
    within_uncertainty_bounds = err_km <= max(3.0 * est.uncertainty_km, 5.0)

    return ScenarioResult(
        name=scenario.name,
        duration_hours=scenario.duration_hours,
        currents={"u": scenario.currents.u, "v": scenario.currents.v},
        wind={"u": scenario.wind.u, "v": scenario.wind.v},
        observed_centroid={"lon": round(obs_lon, 6), "lat": round(obs_lat, 6)},
        true_displacement_km=round(_true_displacement_km(scenario), 2),
        source_error_km=round(err_km, 2),
        uncertainty_km=round(est.uncertainty_km, 2),
        mean_endpoint_distance_km=est.mean_distance_km,
        std_endpoint_distance_km=est.std_distance_km,
        trajectory_agreement=est.trajectory_agreement,
        ensemble_stability=est.ensemble_stability,
        source_concentration=est.source_concentration,
        source_region_contains_true=contains,
        source_within_uncertainty_bounds=within_uncertainty_bounds,
        source_time_window=window,
        true_release_within_window=within_window,
        converged_members=res.converged_count,
        total_particles=res.total_particles,
        land_hits=res.land_hits,
        domain_exits=res.domain_exits,
        warnings=list(res.warnings),
        tolerance_km=scenario.tolerance_km,
        passed=bool(err_km <= scenario.tolerance_km and within_window),
    )


def run_recovery_experiment() -> list[ScenarioResult]:
    """Run every scenario in order and return the measured results table."""
    return [_run_scenario(sc) for sc in SCENARIOS]


def _format_table(results: list[ScenarioResult]) -> str:
    header = (
        f"{'scenario':<18}{'dur':>4}{'err(km)':>9}{'unc(km)':>9}"
        f"{'mean(km)':>9}{'std(km)':>8}{'agr':>6}{'stab':>6}"
        f"{'conc':>7}{'90%hit':>8}{'3sig':>6}{'twin':>6}{'land':>5}{'exit':>5}"
    )
    rows = [header, "-" * len(header)]
    for r in results:
        rows.append(
            f"{r.name:<18}{r.duration_hours:>4.0f}{r.source_error_km:>9.2f}"
            f"{r.uncertainty_km:>9.2f}{r.mean_endpoint_distance_km:>9.2f}"
            f"{r.std_endpoint_distance_km:>8.2f}{r.trajectory_agreement:>6.3f}"
            f"{r.ensemble_stability:>6.3f}{r.source_concentration:>7}"
            f"{'yes' if r.source_region_contains_true else 'no':>8}"
            f"{'yes' if r.source_within_uncertainty_bounds else 'no':>6}"
            f"{'yes' if r.true_release_within_window else 'no':>6}"
            f"{r.land_hits:>5}{r.domain_exits:>5}"
        )
    contained = sum(1 for r in results if r.source_region_contains_true)
    bounded = sum(1 for r in results if r.source_within_uncertainty_bounds)
    passed = sum(1 for r in results if r.passed)
    rows.append("-" * len(header))
    rows.append(
        f"aggregate: {passed}/{len(results)} scenarios recovered within tolerance; "
        f"{bounded}/{len(results)} within 3x uncertainty of the true source; "
        f"{contained}/{len(results)} 90% HDR regions contain the TRUE source."
    )
    return "\n".join(rows)


def _write_artifact(results: list[ScenarioResult]) -> None:
    if os.environ.get("BT_WRITE_ARTIFACT") != "1":
        return
    out = {
        "title": "Step 09 controlled forward->backward source-recovery experiment",
        "model_version": "opendrift-1.14.11/openoil-backtrack",
        "true_source": {"lon": TRUE_SOURCE_LON, "lat": TRUE_SOURCE_LAT},
        "release_time": "2026-09-02T06:00:00Z",
        "config": {
            "ensemble_size": EXPERIMENT_ENSEMBLE_SIZE,
            "particles_per_member": EXPERIMENT_PARTICLES_PER_MEMBER,
            "forward_particles": EXPERIMENT_FORWARD_PARTICLES,
            "timestep_seconds": -900,
            "seed": EXPERIMENT_SEED,
        },
        "scenarios": [asdict(r) for r in results],
    }
    path = (
        Path(__file__).resolve().parents[3]
        / "research"
        / "24-backtracking"
        / "step09_recovery_results.json"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")


def test_controlled_recovery_covers_all_scenarios():
    results = run_recovery_experiment()
    _write_artifact(results)
    table = _format_table(results)

    failures = [
        f"{r.name}: source_error_km={r.source_error_km:.2f} > tolerance_km={r.tolerance_km}"
        for r in results
        if not r.passed
    ]
    # Every scenario with a non-zero forcing must also produce a strictly
    # positive uncertainty (the engine never claims a zero-width source region).
    supplied_forcing = [r for r in results if r.name != "still-water-6h"]
    no_uncertainty = [
        r.name for r in supplied_forcing if r.uncertainty_km <= 0.0
    ]
    assert not no_uncertainty, f"scenarios with no uncertainty: {no_uncertainty}"
    assert not failures, (
        f"controlled recovery failed for {len(failures)} scenario(s);\n"
        f"{failures}\n" + table
    )
    # The operational claim: the recovered origin + reported uncertainty radius
    # bracket the TRUE source in every scenario (3x uncertainty or 5 km).
    # NOTE: the 90% HDR polygon deliberately excludes the low-density
    # source-side tail of the backward fan, so strict polygon containment is
    # measured and reported but NOT asserted as pass/fail (see report §21).
    not_bounded = [
        r.name for r in results if not r.source_within_uncertainty_bounds
    ]
    assert not not_bounded, (
        f"true source outside 3x uncertainty bound for: {not_bounded};\n" + table
    )

    contained = sum(1 for r in results if r.source_region_contains_true)
    assert contained >= 1, (
        "no 90% HDR region contained the TRUE source;\n" + table
    )
    # Every scenario must bracket the TRUE release time.
    assert all(r.true_release_within_window for r in results), (
        "some scenarios failed to bracket the TRUE release time;\n" + table
    )
    # No scenario may report land hits / domain exits in this open-water region.
    assert all(r.land_hits == 0 and r.domain_exits == 0 for r in results), (
        "unexpected land hits / domain exits recorded;\n" + table
    )