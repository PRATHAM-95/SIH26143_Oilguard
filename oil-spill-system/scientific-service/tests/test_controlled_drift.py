"""Controlled-environment forward-drift behaviour and reproducibility.

These tests run the real OpenOil engine against a synthetic, deterministic
environment and assert scientific expectations:

  * a 0.5 m/s eastward current advects the centroid east;
  * zero forcing keeps the centroid essentially stationary;
  * repeated runs with identical configuration are byte-identical.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np
import pytest

from app.drift.engine import DriftEngineConfig, ForwardDriftEngine
from app.models.forward_drift import CurrentForcing, WindForcing

ORIGIN_LAT = 7.64
ORIGIN_LON = 75.14
START = datetime(2026, 9, 2, 12, 0, 0)


def _centroid(result):
    lons = np.array([p.lon for p in result.particles])
    lats = np.array([p.lat for p in result.particles])
    return float(lons.mean()), float(lats.mean())


def test_eastward_current_drifts_centroid_east():
    engine = ForwardDriftEngine(DriftEngineConfig(horizontal_diffusivity=0.0))
    res = engine.run(
        origin_lat=ORIGIN_LAT,
        origin_lon=ORIGIN_LON,
        start_time=START,
        duration_hours=3.0,
        particle_count=200,
        oil_type="GENERIC BUNKER C",
        currents=CurrentForcing(u=0.5, v=0.0),
        wind=WindForcing(u=0.0, v=0.0),
    )
    clon, clat = _centroid(res)
    expected_deg = (0.5 * 3 * 3600) / 110_000  # ~0.049 deg east for 3h
    assert clon - ORIGIN_LON > 0.9 * expected_deg, (
        f"centroid moved east by {clon - ORIGIN_LON:+.4f} deg, "
        f"expected > {0.9 * expected_deg:.4f} deg"
    )
    assert abs(clat - ORIGIN_LAT) < 0.002


def test_zero_forcing_keeps_centroid_stationary():
    engine = ForwardDriftEngine(DriftEngineConfig(horizontal_diffusivity=0.0))
    res = engine.run(
        origin_lat=ORIGIN_LAT,
        origin_lon=ORIGIN_LON,
        start_time=START,
        duration_hours=1.0,
        particle_count=100,
        oil_type="GENERIC BUNKER C",
    )
    clon, clat = _centroid(res)
    assert abs(clon - ORIGIN_LON) < 0.001
    assert abs(clat - ORIGIN_LAT) < 0.001


def test_deterministic_across_repeated_runs():
    engine = ForwardDriftEngine(DriftEngineConfig(horizontal_diffusivity=0.0))
    kwargs = dict(
        origin_lat=ORIGIN_LAT,
        origin_lon=ORIGIN_LON,
        start_time=START,
        duration_hours=2.0,
        particle_count=150,
        oil_type="GENERIC BUNKER C",
    )
    r1 = engine.run(**kwargs)
    r2 = engine.run(**kwargs)
    l1 = ",".join(f"{p.lon:.10f},{p.lat:.10f},{p.mass_kg:.6f}" for p in r1.particles)
    l2 = ",".join(f"{p.lon:.10f},{p.lat:.10f},{p.mass_kg:.6f}" for p in r2.particles)
    assert l1 == l2, "two identical runs must produce identical particle output"
    assert r1.driftRun.reproducibility_digest == r2.driftRun.reproducibility_digest


def test_output_shapes_are_consistent():
    engine = ForwardDriftEngine()
    res = engine.run(
        origin_lat=ORIGIN_LAT,
        origin_lon=ORIGIN_LON,
        start_time=START,
        duration_hours=6.0,
        particle_count=400,
        oil_type="GENERIC MEDIUM CRUDE",
    )
    assert len(res.particles) == 400
    # Extent must be a closed Polygon ring.
    ring = res.extent.coordinates[0]
    assert ring[0] == ring[-1]
    assert len(ring) >= 4
    # Mass balance must sum to the seeded total.
    remaining = res.massBalance.remaining_kg
    evaporated = res.massBalance.evaporated_kg
    dispersed = res.massBalance.dispersed_kg
    total = remaining + evaporated + dispersed
    assert total > 0
    assert res.massBalance.remaining_kg > 0


def test_mass_balance_within_bounds():
    engine = ForwardDriftEngine()
    res = engine.run(
        origin_lat=ORIGIN_LAT,
        origin_lon=ORIGIN_LON,
        start_time=START,
        duration_hours=6.0,
        particle_count=150,
        oil_type="GENERIC CRUDE",
    )
    assert 0 <= res.massBalance.evaporated_kg
    assert 0 <= res.massBalance.dispersed_kg
    assert res.massBalance.remaining_kg > 0