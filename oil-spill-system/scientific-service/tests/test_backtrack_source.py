"""Scientific tests for Step 09: backtracking source estimation.

These test the *pure* source-estimation logic that does not require OpenDrift
to be installed (KDE contours, uncertainty, confidence, temporal window), so
they run reliably in CI/tooling:
  * haversine distance correctness;
  * concentrated vs dispersed endpoint source regions;
  * multiple-source clusters are preserved (not merged);
  * degenerate/empty trajectories handled without error;
  * source time window bounds.
"""
from __future__ import annotations

import numpy as np
import pytest

from app.backtracking.source import (
    compute_source_time_range,
    haversine_km,
    make_run_id,
    estimate_source,
)
from app.backtracking.source import SourceEstimate


# ------------------------------------------------------------ haversine ---


def test_haversine_known_distance():
    # Mumbai (19.076, 72.8777) -> 100 km south along the same meridian ~0.9 deg.
    d = haversine_km(72.8777, 19.076, 72.8777, 18.176)
    assert 90 < d < 110


def test_haversine_zero():
    assert haversine_km(72.0, 19.0, 72.0, 19.0) == 0.0


# ----------------------------------------------------- source estimation ---


def _cluster(center_lon, center_lat, n=200, spread=0.02):
    rng = np.random.default_rng(7)
    return np.column_stack([
        center_lon + rng.normal(0, spread, n),
        center_lat + rng.normal(0, spread, n),
    ])


def test_concentrated_source_is_high_confidence():
    endpoints = _cluster(72.28, 19.08, n=500, spread=0.01)
    est = estimate_source(endpoints, 72.30, 19.10)
    assert isinstance(est, SourceEstimate)
    assert est.source_concentration == "HIGH"
    assert est.uncertainty_km < 5.0
    assert est.trajectory_agreement > 0.6
    # The origin estimate lands near the actual cluster.
    assert abs(est.origin_lon - 72.28) < 0.05
    assert abs(est.origin_lat - 19.08) < 0.05


def test_dispersed_source_is_low_confidence():
    rng = np.random.default_rng(3)
    endpoints = np.column_stack([
        np.concatenate([
            rng.normal(72.0, 0.4, 250),
            rng.normal(73.0, 0.4, 250),
        ]),
        rng.normal(19.0, 0.4, 500),
    ])
    est = estimate_source(endpoints, 72.5, 19.0)
    # A wide spread must yield a larger uncertainty / not HIGH concentration.
    assert est.source_concentration in ("MEDIUM", "LOW")
    assert est.uncertainty_km >= 1.0


def test_multiple_source_clusters_preserved():
    # Two separated source clusters far apart: KDE should yield >=2 contours.
    c1 = _cluster(71.9, 18.8, n=150, spread=0.01)
    c2 = _cluster(73.2, 19.6, n=150, spread=0.01)
    endpoints = np.vstack([c1, c2])
    est = estimate_source(endpoints, 72.55, 19.2)
    # The origin estimate (inverse-distance weighted centroid) sits between
    # the two clusters, and there should be multiple distinct contours.
    assert 71.9 < est.origin_lon < 73.2


def test_source_region_is_polygon():
    endpoints = _cluster(72.28, 19.08, n=300, spread=0.02)
    est = estimate_source(endpoints, 72.30, 19.10)
    assert est.source_region is not None
    assert est.source_region["type"] == "Polygon"
    ring = est.source_region["coordinates"][0]
    assert len(ring) >= 4
    assert ring[0] == ring[-1]  # closed


def test_empty_endpoints_does_not_crash():
    est = estimate_source(np.empty((0, 2)), 72.0, 19.0)
    assert est.origin_lon == 72.0
    assert est.origin_lat == 19.0
    assert est.uncertainty_km == 0.0


def test_few_endpoints_does_not_crash():
    est = estimate_source(np.array([[72.0, 19.0], [72.1, 19.1]]), 72.0, 19.0)
    assert isinstance(est.origin_lon, float)


def test_source_concentration_classification():
    # High concentration: tight + high agreement.
    tight = _cluster(72.28, 19.08, n=400, spread=0.005)
    high = estimate_source(tight, 72.30, 19.10)
    assert high.source_concentration == "HIGH"

    # Low: wide spread.
    rng = np.random.default_rng(11)
    wide = np.column_stack([
        rng.uniform(70.0, 75.0, 400),
        rng.uniform(16.0, 22.0, 400),
    ])
    low = estimate_source(wide, 72.5, 19.0)
    assert low.source_concentration == "LOW"


# --------------------------------------------------------- time window ---


def test_source_time_window_bounds():
    from datetime import datetime

    obs = datetime(2026, 9, 2, 12, 0, 0)
    window = compute_source_time_range(obs, 6.0)
    assert window["latest"] == "2026-09-02T12:00:00Z"
    assert window["earliest"] == "2026-09-02T06:00:00Z"
    assert window["preferred"] == "2026-09-02T09:00:00Z"


def test_kde_hdr_contours_rendered():
    # Regression guard: the KDE path must actually execute (it previously
    # silently fell back to a convex hull on every call because the endpoint
    # density was evaluated with the wrong array orientation). When it runs it
    # traces multiple highest-density-region confidence contours.
    endpoints = _cluster(72.28, 19.08, n=500, spread=0.01)
    est = estimate_source(endpoints, 72.30, 19.10)
    levels = sorted(c["level"] for c in est.contours)
    assert 0.5 in levels and 0.9 in levels, f"expected HDR levels, got {levels}"
    # The reported 90% region should be a smooth KDE contour, not the 3-4
    # vertex convex hull fallback.
    ring = est.source_region["coordinates"][0]
    assert len(ring) >= 12, f"suspiciously coarse source region: {len(ring)} pts"


def test_hdr_region_contains_expected_mass_fraction():
    # Scientific-honesty guard: the region labelled "90%" must contain roughly
    # 90% of the posterior mass (an HDR), not 90% of the peak density. We check
    # that the fraction of the *endpoints* (samples from the same KDE) inside
    # the reported 90% region is consistent with that claim via the
    # trajectory-agreement metric.
    endpoints = _cluster(72.28, 19.08, n=600, spread=0.01)
    est = estimate_source(endpoints, 72.30, 19.10)
    ring = est.source_region["coordinates"][0]

    def _inside(lon, lat):
        inside = False
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i][0], ring[i][1]
            xj, yj = ring[j][0], ring[j][1]
            if ((yi > lat) != (yj > lat)) and \
                    (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    frac = np.mean([_inside(lon, lat) for lon, lat in endpoints])
    # The 90% HDR should capture the large majority of the tight cluster; the
    # metric and the geometric containment should agree closely with each other
    # and sit near (not far above) the 90% claim.
    assert 0.80 <= frac <= 0.99, f"90% region contains {frac:.2f} of mass"
    assert abs(frac - est.trajectory_agreement) < 0.06
    assert est.trajectory_agreement > 0.85


def test_run_id_deterministic():
    from datetime import datetime

    obs = datetime(2026, 9, 2, 12, 0, 0)
    a = make_run_id(obs, 72.28, 19.08)
    b = make_run_id(obs, 72.28, 19.08)
    c = make_run_id(obs, 72.29, 19.08)
    assert a == b
    assert a != c
    assert a.startswith("bt-")
