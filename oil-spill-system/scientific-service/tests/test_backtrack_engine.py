"""Scientific engine tests for Step 09: OpenDrift backward backtracking.

These tests exercise the real OpenDrift backward engine and therefore require
OpenDrift to be installed. When it is absent they are SKIPPED (not failed), so
the rest of the suite still collects — consistent with the other drift tests.

Covered:
  * backward propagation reverses a constant current (endpoints move up-current);
  * a controlled forward-then-backward scenario recovers a plausible source;
  * the ensemble is reproducible for a fixed seed and varies with perturbation;
  * each member's perturbed parameters stay within the configured ranges.
"""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pytest

pytest.importorskip("opendrift", reason="OpenDrift not installed")

from app.backtracking.engine import (  # noqa: E402
    BacktrackConfig,
    run_backtrack_ensemble,
)
from app.backtracking.source import haversine_km  # noqa: E402
from app.models.forward_drift import CurrentForcing  # noqa: E402

_OBS = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)

# A small, fast ensemble so the test stays cheap.
def _config(**kw):
    base = dict(ensemble_size=4, particles_per_member=40, duration_hours=6.0,
                timestep_seconds=-900, seed=1234)
    base.update(kw)
    return BacktrackConfig(**base)


def test_backward_propagates_against_a_constant_current():
    # A constant eastward current (u=+0.5 m/s) moves oil east in forward time.
    # Backtracking (negative timestep) must reverse this: endpoints should sit
    # WEST of the observation point (up-current toward the source).
    lon_obs = 72.15
    lat_obs = 19.1
    res = run_backtrack_ensemble(
        slick_lon=lon_obs,
        slick_lat=lat_obs,
        observation_time=_OBS,
        config=_config(),
        environment_source="CONTROLLED",
        currents=CurrentForcing(u=0.5, v=0.0),
        wind=CurrentForcing(u=0.0, v=0.0),
    )
    assert res.all_endpoints is not None and res.all_endpoints.shape[0] > 0
    mean_lon = float(np.mean(res.all_endpoints[:, 0]))
    # Endpoints should be up-current (west) of the observation.
    assert mean_lon < lon_obs, f"expected westward shift, got mean_lon={mean_lon}"


def test_controlled_reversal_recovers_plausible_source():
    # True source; a constant +0.5 m/s eastward current for 6 h displaces the
    # slick ~10.8 km east of the source. Backtracking from the observed slick
    # should concentrate endpoints near the TRUE source.
    true_lon, true_lat = 71.9, 18.6
    # ~10.8 km east at this latitude.
    lon_obs = 71.9 + 10.8 / 105.0
    lat_obs = true_lat

    res = run_backtrack_ensemble(
        slick_lon=lon_obs,
        slick_lat=lat_obs,
        observation_time=_OBS,
        config=_config(ensemble_size=6, particles_per_member=60),
        environment_source="CONTROLLED",
        currents=CurrentForcing(u=0.5, v=0.0),
        wind=CurrentForcing(u=0.0, v=0.0),
    )
    assert res.converged_count > 0
    eps = res.all_endpoints
    mean_lon = float(np.mean(eps[:, 0]))
    mean_lat = float(np.mean(eps[:, 1]))
    dist = haversine_km(mean_lon, mean_lat, true_lon, true_lat)
    # Tolerances allow for diffusion and OpenOil's wind/deflection handling;
    # the point is the backward fan reconstructs a plausible source region.
    assert dist < 40.0, f"recovered source {dist:.1f} km from true source"


def test_ensemble_reproducible_for_fixed_seed():
    a = run_backtrack_ensemble(
        slick_lon=72.0, slick_lat=19.0, observation_time=_OBS,
        config=_config(seed=99), currents=CurrentForcing(u=0.2, v=0.0),
    )
    b = run_backtrack_ensemble(
        slick_lon=72.0, slick_lat=19.0, observation_time=_OBS,
        config=_config(seed=99), currents=CurrentForcing(u=0.2, v=0.0),
    )
    c = run_backtrack_ensemble(
        slick_lon=72.0, slick_lat=19.0, observation_time=_OBS,
        config=_config(seed=7), currents=CurrentForcing(u=0.2, v=0.0),
    )
    np.testing.assert_allclose(a.all_endpoints, b.all_endpoints, atol=1e-9)
    # A different seed perturbs parameters and therefore the trajectory fan.
    assert not np.allclose(a.all_endpoints, c.all_endpoints, atol=1e-9)


def test_member_parameters_stay_within_configured_ranges():
    cfg = _config(
        wind_drift_factor_range=(0.02, 0.04),
        diffusion_range=(1.0, 20.0),
        current_uncertainty=(0.85, 1.15),
    )
    res = run_backtrack_ensemble(
        slick_lon=72.0, slick_lat=19.0, observation_time=_OBS,
        config=cfg, currents=CurrentForcing(u=0.2, v=0.0),
    )
    assert res.members
    for m in res.members:
        assert 0.02 <= m.wind_drift_factor <= 0.04
        assert 1.0 <= m.diffusivity <= 20.0
        assert 0.85 <= m.current_scale <= 1.15
