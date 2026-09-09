"""Deterministic SAR-like fixture generation.

Produces a repeatable, clearly-labelled SYNTHETIC backscatter field that the
classical dark-spot detector genuinely processes. It is NOT real Sentinel-1
data and must never be presented as such (see :class:`SarScene.source_state`).

The fixture embeds:
  * a large elongated dark region  -> oil-slick surrogate (OIL_CANDIDATE),
  * a compact circular dark region -> look-alike surrogate (low-wind/rain),
  * a small compact dark speck     -> small / low-confidence candidate,
  * a bright land block            -> exercises land masking.

All geometry is deterministic (fixed numpy seed) so tests and the demo render
identically every run.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache

import numpy as np

from .contract import GeoTransform, ProvenanceState, SarScene

_FEATURE_SEED = 26143


def _gaussian_field(shape, seed, scale_db) -> np.ndarray:
    rng = np.random.default_rng(seed)
    noise = rng.normal(0.0, scale_db, size=shape)
    # Light smoothing approximates spatially-correlated sea-surface roughness.
    from scipy.ndimage import gaussian_filter

    return gaussian_filter(noise, sigma=2.0)


def _ellipse_mask(shape, cy, cx, ry, rx, angle_deg) -> np.ndarray:
    rows, cols = np.indices(shape, dtype=float)
    a = np.radians(angle_deg)
    ca, sa = np.cos(a), np.sin(a)
    dy = rows - cy
    dx = cols - cx
    ry_ = max(1.0, ry)
    rx_ = max(1.0, rx)
    # rotate into ellipse frame
    x2 = (dx * ca + dy * sa) / rx_
    y2 = (-dx * sa + dy * ca) / ry_
    return (x2 ** 2 + y2 ** 2) <= 1.0


def _disc_mask(shape, cy, cx, radius) -> np.ndarray:
    rows, cols = np.indices(shape, dtype=float)
    return ((rows - cy) ** 2 + (cols - cx) ** 2) <= radius ** 2


def _allocate_scene(
    rows: int,
    cols: int,
    west_lon: float,
    north_lat: float,
    px_deg: float,
    acquisition_iso: str,
    polarization: str,
) -> SarScene:
    """Build and return a fresh ``SarScene``.

    Constructing a new scene on every call (rather than returning one cached
    object) guarantees each caller owns its ``amplitude_db`` / ``land_mask``
    arrays and its mutable ``processing_log``, so concurrent SAR detections can
    never mutate a shared numpy-backed scene.
    """
    amp_db = _compute_fixture_field(rows, cols).copy()
    land_mask = make_land_mask(amp_db)
    geo = GeoTransform(
        west_lon=west_lon,
        north_lat=north_lat,
        px_deg_lon=px_deg,
        px_deg_lat=px_deg,
    )
    acquisition = (
        datetime.fromisoformat(acquisition_iso.replace("Z", "+00:00"))
        if "Z" in acquisition_iso
        else datetime.fromisoformat(acquisition_iso)
    )
    return SarScene(
        scene_id="fixture-synth-26143",
        acquisition_time=acquisition,
        satellites=[],
        polarization=polarization,
        geotransform=geo,
        amplitude_db=amp_db,
        land_mask=land_mask,
        source="LOCAL_FIXTURE",
        source_state=ProvenanceState.LOCAL_FIXTURE,
        provider_dataset="synthetic fixture (demo, not real Sentinel-1)",
        processing_log=list(_FIXTURE_PROCESSING_LOG),
    )


@lru_cache(maxsize=16)
def _compute_fixture_field(rows: int, cols: int) -> np.ndarray:
    """Deterministically compute the fixture ``amplitude_db`` field (cached).

    The scene geometry (and therefore the installed detector artefacts) depends
    only on ``(rows, cols)``, so the expensive gaussian smoothing is computed
    once per shape and reused. Returns an array the caller must copy before
    mutating.
    """
    rng = np.random.default_rng(_FEATURE_SEED)

    # Open-sea background: a tightly clustered backscatter field around a clear
    # reference level (noise-floor limited, as in calibrated SAR) so that the
    # lower-backscatter slicks sit cleanly below the sea reference. The sea
    # varies gently (spatially correlated) but does not overlap the slicks.
    sea_level_db = -1.5
    amp_db = sea_level_db + _gaussian_field((rows, cols), seed=_FEATURE_SEED, scale_db=0.35)

    # 1) elongated oil-slick surrogate (dips ~ -6 dB below the sea reference).
    slick = _ellipse_mask((rows, cols), cy=rows * 0.42, cx=cols * 0.4, ry=rows * 0.07, rx=cols * 0.24, angle_deg=32)
    amp_db[slick] -= 6.0
    # realistic ragged edge (small perimeter perturbation, keeps interior solid)
    edge = _gaussian_field((rows, cols), seed=_FEATURE_SEED, scale_db=0.7) > 0.4
    amp_db[slick & edge] += 1.8

    # 2) compact circular look-alike surrogate (low-wind / rain cell).
    lookalike = _disc_mask((rows, cols), cy=rows * 0.72, cx=cols * 0.72, radius=rows * 0.055)
    amp_db[lookalike] -= 5.0

    # 3) small compact dark speck (small / low-confidence candidate).
    small = _disc_mask((rows, cols), cy=rows * 0.2, cx=cols * 0.8, radius=rows * 0.018)
    amp_db[small] -= 5.5

    # 4) bright land block (should be masked out).
    amp_db[int(rows * 0.98):, :] += 9.0

    return amp_db


_FIXTURE_PROCESSING_LOG = [
    "fixture: deterministic synthetic backscatter (SYNTHETIC/DEMO)",
    "fixture: dB field, no radiometric calibration applied (fixture provenance)",
]


def build_fixture_scene(
    rows: int = 320,
    cols: int = 320,
    west_lon: float = 72.0,
    north_lat: float = 15.0,
    px_deg: float = 0.001,
    acquisition_iso: str = "2026-09-02T12:00:00Z",
    seed: int = _FEATURE_SEED,
    polarization: str = "VV",
) -> SarScene:
    """Build the deterministic synthetic SAR fixture scene.

    (``seed`` is accepted for backwards compatibility; the deterministic field
    is indexed by ``(rows, cols)`` so the returned pixel geometry is stable.)
    """
    return _allocate_scene(
        rows,
        cols,
        west_lon,
        north_lat,
        px_deg,
        acquisition_iso,
        polarization,
    )


def make_land_mask(amp: np.ndarray, threshold_db: float = -1.0) -> np.ndarray:
    """Build the land/nodata mask for a fixture backscatter array."""
    amp = np.asarray(amp, dtype=float)
    arr = np.zeros_like(amp, dtype=bool)
    # rebuild land from the same deterministic rule used by the generator
    rows, cols = amp.shape
    arr[ int(rows * 0.98) :, :] = True
    bright = amp > threshold_db
    arr |= bright
    arr |= np.isnan(amp) | np.isneginf(amp)
    return arr
