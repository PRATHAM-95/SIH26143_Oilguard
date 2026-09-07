"""Source region estimation from backtracking ensemble endpoints.

Uses Kernel Density Estimation (KDE) to produce probability contours and
identify the most probable source region. This is the standard scientific
approach (Chen 2019, Breivik et al. 2025).

The source region is reported as confidence contours (50%, 75%, 90%) rather
than a single point, because an exact source point claim is scientifically
indefensible (see research report).
"""

from __future__ import annotations

import hashlib
import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import numpy as np

log = logging.getLogger("oilspill.backtracking.source")

# Earth radius for haversine (km).
_EARTH_RADIUS_KM = 6371.0

_UTC = timezone.utc


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Haversine distance between two points (degrees) in km."""
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


@dataclass
class SourceEstimate:
    """Result of source region estimation."""

    # Weighted centroid of the source region.
    origin_lon: float
    origin_lat: float
    # Uncertainty radius (km) — 2x standard deviation of endpoint cluster.
    uncertainty_km: float
    # Confidence contours as GeoJSON Polygons [{level, polygon}].
    contours: List[dict] = field(default_factory=list)
    # Source region polygon (90% contour or convex hull fallback).
    source_region: Optional[dict] = None
    # KDE grid for probability visualization.
    probability_grid: Optional[dict] = None
    # Quality metrics.
    trajectory_agreement: float = 0.0
    ensemble_stability: float = 0.0
    source_concentration: str = "LOW"
    # Endpoint statistics.
    mean_distance_km: float = 0.0
    std_distance_km: float = 0.0


def estimate_source(
    all_endpoints: np.ndarray,
    slick_lon: float,
    slick_lat: float,
    contour_levels: Optional[List[float]] = None,
) -> SourceEstimate:
    """Estimate the probable source region from ensemble backtracking endpoints.

    Parameters
    ----------
    all_endpoints : np.ndarray
        Shape (N, 2) with columns [longitude, latitude]. Collected from all
        ensemble member final positions.
    slick_lon, slick_lat : float
        The observation point (slick centroid). Used as reference for distance
        statistics.
    contour_levels : list of float, optional
        Probability levels for contours (e.g. [0.5, 0.75, 0.9]). Defaults
        to [0.5, 0.75, 0.9].

    Returns
    -------
    SourceEstimate
    """
    if contour_levels is None:
        contour_levels = [0.5, 0.75, 0.9]

    if all_endpoints.shape[0] < 3:
        return _degenerate_estimate(all_endpoints, slick_lon, slick_lat)

    lons = all_endpoints[:, 0]
    lats = all_endpoints[:, 1]

    # --- Distance statistics (relative to the observation point) ---
    distances = np.array([
        haversine_km(slick_lon, slick_lat, lo, la)
        for lo, la in zip(lons, lats)
    ])
    mean_dist = float(np.mean(distances))
    std_dist = float(np.std(distances))

    # --- Weighted centroid (inverse-distance weighting) ---
    weights = 1.0 / (distances + 0.01)  # avoid division by zero
    origin_lon = float(np.average(lons, weights=weights))
    origin_lat = float(np.average(lats, weights=weights))

    # --- Uncertainty: 2x std of endpoint spread in km ---
    endpoint_spread_km = _compute_spread_km(lons, lats)
    uncertainty_km = max(endpoint_spread_km, 0.5)  # floor at 500m

    # --- KDE contour extraction ---
    contours = []
    source_region = None
    probability_grid = None

    try:
        from scipy.stats import gaussian_kde

        # Fit KDE on the endpoint cloud.
        coords = np.vstack([lons, lats])
        kde = gaussian_kde(coords, bw_method="scott")

        # Create a grid for contour extraction.
        lon_range = lons.max() - lons.min()
        lat_range = lats.max() - lats.min()
        margin = max(lon_range, lat_range) * 0.3 + 0.005
        grid_n = 100

        x_grid = np.linspace(origin_lon - margin, origin_lon + margin, grid_n)
        y_grid = np.linspace(origin_lat - margin, origin_lat + margin, grid_n)
        X, Y = np.meshgrid(x_grid, y_grid)
        grid_coords = np.vstack([X.ravel(), Y.ravel()])

        Z = kde(grid_coords).reshape(X.shape)

        # Normalize Z to [0, 1] so contours represent probability mass.
        Z_max = Z.max()
        if Z_max > 0:
            Z_norm = Z / Z_max
        else:
            Z_norm = Z

        # Compute, for every requested confidence level, the density threshold
        # enclosing that fraction of the total probability mass (a Highest
        # Density Region threshold). The labels ("50%"/"75%"/"90%") are thereby
        # honest statements about the posterior mass in each region rather than
        # fractions of the peak density.
        hdr_by_level = {
            level: _hdr_density_threshold(Z, float(level))
            for level in contour_levels
        }
        target_mass = max(contour_levels)
        hdr_threshold = hdr_by_level[target_mass]

        # Trajectory agreement: fraction of endpoints whose KDE density is
        # within the target (highest-confidence) HDR. Scientially meaningful:
        # how many backtrajectory endpoints converge into the probable region.
        endpoint_density = kde(np.vstack([lons, lats]))
        if hdr_threshold > 0 and len(endpoint_density) > 0:
            trajectory_agreement = float(
                np.mean(endpoint_density >= hdr_threshold)
            )
        else:
            trajectory_agreement = 0.0

        # Extract contours at the HDR density levels (normalized by the peak so
        # they can be traced by matplotlib on Z_norm).
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            level_values = sorted(
                set(hdr_by_level[level] / Z_max for level in contour_levels
                    if hdr_by_level[level] > 0)
            )
            fig, ax = plt.subplots()
            cs = ax.contour(X, Y, Z_norm, levels=level_values)

            for level, segs in zip(cs.levels, cs.allsegs):
                for seg in segs:
                    if seg.shape[0] < 4:
                        continue
                    ring = [[float(v[0]), float(v[1])] for v in seg]
                    if ring[0] != ring[-1]:
                        ring.append(ring[0])
                    # Map the normalized density level back to the mass fraction
                    # it represents so the contour keeps a confidence label.
                    norm_threshold = float(level) * Z_max
                    conf = min(
                        (lvl for lvl in contour_levels),
                        key=lambda lvl: abs(hdr_by_level[lvl] - norm_threshold),
                    )
                    contours.append({
                        "level": float(conf),
                        "polygon": {
                            "type": "Polygon",
                            "coordinates": [ring],
                        },
                    })
            plt.close(fig)
        except Exception as exc:
            log.warning("KDE contour extraction failed: %s", exc)

        # The target HDR contour (highest available) is the reported source
        # region. If matplotlib failed to trace it, fall back to the KDE
        # level-set outline built from the density grid.
        if contours:
            source_region = max(contours, key=lambda c: c["level"])["polygon"]
        else:
            source_region = _kd_level_set_region(X, Y, Z, hdr_threshold)

        # Build a compact probability grid for frontend heatmap rendering.
        sample_n = 25
        step_x = max(1, grid_n // sample_n)
        step_y = max(1, grid_n // sample_n)
        prob_grid = []
        for yi in range(0, grid_n, step_y):
            for xi in range(0, grid_n, step_x):
                prob_grid.append({
                    "lon": float(X[yi, xi]),
                    "lat": float(Y[yi, xi]),
                    "density": float(Z_norm[yi, xi]),
                })
        probability_grid = {"type": "heatmap", "points": prob_grid}

    except ImportError:
        log.warning("scipy/matplotlib unavailable; falling back to convex hull for source region.")
        source_region = _convex_hull_region(lons, lats)
        trajectory_agreement = _fallback_agreement(lons, lats, source_region)

    except Exception as exc:
        log.warning("KDE estimation failed: %s; using convex hull fallback.", exc)
        source_region = _convex_hull_region(lons, lats)
        trajectory_agreement = _fallback_agreement(lons, lats, source_region)

    # --- Fallback source region from convex hull if KDE didn't produce one ---
    if source_region is None:
        source_region = _convex_hull_region(lons, lats)
        trajectory_agreement = _fallback_agreement(lons, lats, source_region)

    # Ensemble stability: inverse CV of endpoint distances.
    if mean_dist > 0:
        ensemble_stability = min(1.0, mean_dist / (std_dist + 0.01))
    else:
        ensemble_stability = 1.0 if std_dist < 0.1 else 0.5

    # --- Source concentration classification ---
    if uncertainty_km < 2.0 and trajectory_agreement > 0.8:
        concentration = "HIGH"
    elif uncertainty_km < 5.0 and trajectory_agreement > 0.5:
        concentration = "MEDIUM"
    else:
        concentration = "LOW"

    return SourceEstimate(
        origin_lon=origin_lon,
        origin_lat=origin_lat,
        uncertainty_km=uncertainty_km,
        contours=contours,
        source_region=source_region,
        probability_grid=probability_grid,
        trajectory_agreement=round(trajectory_agreement, 3),
        ensemble_stability=round(min(1.0, ensemble_stability), 3),
        source_concentration=concentration,
        mean_distance_km=round(mean_dist, 2),
        std_distance_km=round(std_dist, 2),
    )


def _hdr_density_threshold(Z: np.ndarray, target_fraction: float) -> float:
    """Density level enclosing ``target_fraction`` of the total probability mass.

    The Highest Density Region (HDR) of mass fraction ``f`` is
    ``{x | p(x) >= t}`` where ``t`` is the largest value such that the enclosed
    mass equals ``f``. Computing it over the discrete grid ``Z`` gives the
    threshold used to delimit honest confidence regions (e.g. "90% of the
    posterior mass lies inside this source region"), decoupled from the peak
    value of the density.
    """
    if Z.size == 0:
        return 0.0
    flat = Z.ravel()
    order = np.argsort(flat)[::-1]
    sorted_density = flat[order]
    cumsum = np.cumsum(sorted_density)
    total = cumsum[-1]
    if total <= 0:
        return 0.0
    frac = float(np.clip(target_fraction, 0.0, 1.0))
    idx = int(np.searchsorted(cumsum, frac * total))
    idx = min(idx, sorted_density.size - 1)
    return float(sorted_density[idx])


def _compute_spread_km(lons: np.ndarray, lats: np.ndarray) -> float:
    """Compute the spatial spread of endpoints in km (2x std)."""
    if len(lons) < 2:
        return 0.0
    centroid_lon = float(np.mean(lons))
    centroid_lat = float(np.mean(lats))
    spreads = np.array([
        haversine_km(centroid_lon, centroid_lat, lo, la)
        for lo, la in zip(lons, lats)
    ])
    return float(2.0 * np.std(spreads))


def _convex_hull_region(lons: np.ndarray, lats: np.ndarray) -> Optional[dict]:
    """Build a convex hull GeoJSON Polygon from endpoint lon/lat arrays."""
    if len(lons) < 3:
        return None
    try:
        from scipy.spatial import ConvexHull
        points = np.column_stack([lons, lats])
        hull = ConvexHull(points)
        ring = [[float(points[v, 0]), float(points[v, 1])] for v in hull.vertices]
        ring.append(ring[0])
        return {"type": "Polygon", "coordinates": [ring]}
    except Exception:
        # Fallback: bounding box.
        lon_min, lon_max = float(lons.min()), float(lons.max())
        lat_min, lat_max = float(lats.min()), float(lats.max())
        ring = [
            [lon_min, lat_min],
            [lon_max, lat_min],
            [lon_max, lat_max],
            [lon_min, lat_max],
            [lon_min, lat_min],
        ]
        return {"type": "Polygon", "coordinates": [ring]}


def _kd_level_set_region(
    X: np.ndarray, Y: np.ndarray, Z: np.ndarray, threshold: float
) -> dict:
    """Build a GeoJSON Polygon from the KDE density level set {Z >= threshold}.

    Used when matplotlib cannot trace the HDR contour. Constructs a simple
    orthogonal polygon outline around the cells that satisfy the threshold, so
    the reported source region is always a closed polygon even without
    matplotlib contour support.
    """
    cells = Z >= threshold
    # Build a polygon from the enabled cells: convex hull fallback for
    # robustness (a full marching-squares outline is unnecessary here).
    if not cells.any():
        return None
    pts = np.column_stack([X[cells], Y[cells]])
    ring = _convex_hull_ring(pts) if len(pts) >= 3 else None
    if ring:
        return {"type": "Polygon", "coordinates": [ring]}
    # Degenerate: use a convex hull of the original lon/lat arrays if possible.
    return _convex_hull_region(X[cells], Y[cells])


def _convex_hull_ring(points: np.ndarray) -> Optional[list]:
    """Return a closed convex-hull ring (list of [lon, lat]) or None."""
    try:
        from scipy.spatial import ConvexHull
        hull = ConvexHull(points)
        ring = [[float(points[v, 0]), float(points[v, 1])] for v in hull.vertices]
        ring.append(ring[0])
        return ring
    except Exception:
        return None


def _fallback_agreement(
    lons: np.ndarray, lats: np.ndarray, region: Optional[dict]
) -> float:
    """Trajectory agreement from a polygon source region (fallback only)."""
    if region is None or not region.get("coordinates") or len(lons) == 0:
        return 0.0
    ring = region["coordinates"][0]
    inside = sum(1 for lo, la in zip(lons, lats) if _point_in_ring(lo, la, ring))
    return float(inside / len(lons))


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


def _degenerate_estimate(
    endpoints: np.ndarray, slick_lon: float, slick_lat: float
) -> SourceEstimate:
    """Handle degenerate case (too few endpoints)."""
    if endpoints.shape[0] == 0:
        return SourceEstimate(
            origin_lon=slick_lon,
            origin_lat=slick_lat,
            uncertainty_km=0.0,
            source_concentration="LOW",
            trajectory_agreement=0.0,
            ensemble_stability=0.0,
            mean_distance_km=0.0,
            std_distance_km=0.0,
        )
    return SourceEstimate(
        origin_lon=float(endpoints[0, 0]),
        origin_lat=float(endpoints[0, 1]),
        uncertainty_km=0.0,
        source_concentration="LOW",
        trajectory_agreement=0.0,
        ensemble_stability=0.0,
        mean_distance_km=0.0,
        std_distance_km=0.0,
    )


def compute_source_time_range(
    observation_time: datetime,
    duration_hours: float,
) -> dict:
    """Compute the source time window.

    The source must have occurred between (observation - duration) and
    observation. The 'preferred' time is the midpoint. A single exact source
    time is not claimed.
    """
    if observation_time.tzinfo is not None:
        observation_time = observation_time.astimezone(_UTC).replace(tzinfo=None)

    earliest = observation_time - timedelta(hours=duration_hours)
    latest = observation_time
    preferred = earliest + timedelta(hours=duration_hours / 2)

    return {
        "earliest": earliest.isoformat() + "Z",
        "latest": latest.isoformat() + "Z",
        "preferred": preferred.isoformat() + "Z",
    }


def make_run_id(observation_time: datetime, lon: float, lat: float) -> str:
    """Generate a deterministic backtracking run ID."""
    raw = f"bt|{observation_time.isoformat()}|{lon:.4f}|{lat:.4f}"
    return "bt-" + hashlib.sha256(raw.encode("ascii")).hexdigest()[:12]
