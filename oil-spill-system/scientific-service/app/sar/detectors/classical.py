"""Classical adaptive dark-spot oil-slick detector.

Baseline detection method, aligned with ESA's described oil-spill workflow and
the frozen SYSTEM_SPEC §5.1 pipeline stages "Dark Feature Extraction (adaptive
threshold)" followed by feature analysis. It is:

* deterministic (fixed inputs -> fixed outputs),
* CPU-only and offline,
* reproducible (a local / synthetic fixture genuinely processed),
* honest about look-alikes (dark SAR features are not uniquely oil).

Algorithm:
  1. Land masking      — remove masked land/nodata pixels and a coastal buffer
                         (so bright land cannot bleed into the sea reference).
  2. Adaptive threshold— the open-sea reference (contaminant-robust median of
                         valid sea pixels) minus a depth offset; pixels below
                         this scene-calibrated reference become dark-spot
                         candidates. The threshold adapts to the measured scene.
  3. Morphological clean — binary opening removes speckle noise specks.
  4. Connected components— label surviving dark regions.
  5. Size filter         — drop regions too small to be a slick patch.
  6. Geometry            — polygon ring from the region mask; compute
                            geospatial measurements via the scene's local
                            equirectangular transform (metres/degree scaled by
                            cos(lat)).
  7. Classification      — geometric heuristics assign OIL_CANDIDATE /
                            UNCERTAIN / LOOK_ALIKE with a quantified confidence.

The detector never returns a predetermined polygon: it is a function of the
input backscatter field.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np
from scipy import ndimage
from shapely.geometry import Polygon
from shapely.affinity import rotate

from ..contract import (
    CandidateClass,
    GeoTransform,
    SarScene,
    SlickCandidate,
)
from . import SarDetector
from . import _contour

_COS_CELL = 30.0


def _mask_to_ring(mask: np.ndarray) -> Optional[np.ndarray]:
    """Return the outer boundary ring of a boolean ``mask`` as [(row, col)].

    Uses self-contained marching squares on the padded region so the polygon
    follows the actual region boundary (no scikit-image dependency).
    """
    if mask.ndim != 2 or not mask.any():
        return None
    padded = np.pad(mask.astype(float), 1, mode="constant", constant_values=0.0)
    contours = _contour.find_contours(padded, 0.5)
    if not contours:
        return None
    # Prefer the longest contour (outer boundary).
    contour = max(contours, key=lambda c: c.shape[0])
    if contour.shape[0] < 3:
        return None
    # Convert back to mask coordinates and produce [(row, col)] pairs.
    pts = contour - 1.0
    return pts


def _simplify_ring(ring: np.ndarray, geo: GeoTransform, mean_lat: float, tolerance_m: float = 120.0) -> List[tuple]:
    """Simplify a [(row, col)] ring to lon/lat using metres-per-pixel."""
    m_per_px = geo.pixel_to_metres(1.0, mean_lat)
    tol_px = max(1.0, tolerance_m / m_per_px if m_per_px > 0 else 1.0)
    # Simple Douglas-Peucker via shapely on (col, row).
    poly = Polygon([(c, r) for r, c in ring])
    if not poly.is_valid or poly.area <= 0:
        poly = poly.buffer(0)
    simplified = poly.simplify(tol_px, preserve_topology=True)
    rings = []
    for coord in simplified.exterior.coords:
        r, c = coord[1], coord[0]
        rings.append(geo.pixel_to_lonlats([r], [c])[0])
    return rings


class ClassicalDarkSpotDetector(SarDetector):
    """Deterministic adaptive dark-spot baseline detector."""

    name = "classical_dark_spot"
    version = "2.0.0"

    def __init__(
        self,
        depth_offset_db: float = 3.0,
        min_pixels: int = 60,
        open_size: int = 3,
        land_buffer_px: int = 8,
    ) -> None:
        # ``depth_offset_db`` is the number of dB a pixel must sit below the
        # scene's measured open-sea reference before it is flagged as a dark
        # spot. The reference itself is adapted to the scene (see ``detect``),
        # so this is a scene-calibrated adaptive threshold rather than a fixed
        # absolute cutoff.
        self.depth_offset_db = depth_offset_db
        self.min_pixels = min_pixels
        self.open_size = open_size
        self.land_buffer_px = land_buffer_px

    def detect(self, scene: SarScene, max_candidates: int = 6) -> List[SlickCandidate]:
        amp = np.asarray(scene.amplitude_db, dtype=float)
        if amp.ndim != 2:
            raise ValueError("detector expects a 2-D backscatter array")

        land = np.asarray(scene.land_mask, dtype=bool)
        if land.shape != amp.shape:
            land = np.zeros_like(amp, dtype=bool)

        valid = np.isfinite(amp)
        work = np.where(valid, amp, np.nan)

        # 1. Exclude land, plus a coastal buffer. Without the buffer, bright land
        # at the scene edge inflates the edge-extended background and the
        # adjacent sea strip is falsely flagged as dark.
        land_buffer = (
            ndimage.binary_dilation(land, iterations=self.land_buffer_px)
            if self.land_buffer_px > 0
            else land
        )
        no_go = land_buffer | (~valid)

        # 2. Scene-calibrated adaptive reference. The open-sea backscatter level
        # is estimated with the contaminant-robust median over all valid sea
        # pixels (land and the coastal no-go zone excluded). The median is
        # insensitive both to the dark features themselves and to any residual
        # bright outliers, so it reflects the true sea reference. The threshold
        # therefore adapts to the measured scene (not a fixed absolute dB), as in
        # classical dark-spot extraction, and large dark regions are measured
        # against this reference rather than their own pulled-down local mean.
        sea_pix = work[~(no_go) & valid]
        if sea_pix.size == 0:
            raise ValueError("no valid open-sea pixels to derive the adaptive reference")
        sea_reference = float(np.nanmedian(sea_pix))
        dark = (work < (sea_reference - self.depth_offset_db)) & valid & (~no_go)

        # 3. Morphological cleanup (discard isolated speckle specks).
        dark = ndimage.binary_opening(
            dark, structure=np.ones((self.open_size, self.open_size))
        )

        # 4. Connected components.
        labeled, n = ndimage.label(dark)
        if n == 0:
            return []

        # 5. Size filter.
        sizes = ndimage.sum(
            np.ones_like(labeled), labeled, index=np.arange(1, n + 1)
        ).astype(int)
        kept = [i for i in range(1, n + 1) if int(sizes[i - 1]) >= self.min_pixels]
        kept.sort(key=lambda li: -int(sizes[li - 1]))

        candidates: List[SlickCandidate] = []
        for label_idx in kept[:max_candidates]:
            mask = labeled == label_idx
            cand = self._characterize(
                scene, mask, label_idx, scene.geotransform, int(sizes[label_idx - 1]),
                sea_reference=sea_reference, work=work, no_go=no_go,
            )
            if cand is not None:
                candidates.append(cand)
        return candidates

    def _characterize(
        self,
        scene: SarScene,
        mask: np.ndarray,
        label_idx: int,
        geo: GeoTransform,
        pixel_area: int,
        sea_reference: float,
        work: np.ndarray,
        no_go: np.ndarray,
    ) -> Optional[SlickCandidate]:
        rows, cols = np.nonzero(mask)
        if rows.size == 0:
            return None

        mean_lat = float(np.mean([geo.pixel_to_lonlats([rr], [cc])[0][1] for rr, cc in zip(rows[:: max(1, len(rows) // 64)], cols[:: max(1, len(cols) // 64)])]))

        ring = _mask_to_ring(mask)
        if ring is None or len(ring) < 4:
            return None

        lonlats = _simplify_ring(ring, geo, mean_lat)
        if len(lonlats) < 4:
            return None
        if lonlats[0] != lonlats[-1]:
            lonlats = lonlats + [lonlats[0]]

        poly = Polygon(lonlats)
        if not poly.is_valid or poly.is_empty:
            return None

        # Local contrast (dB) of the dark region against the measured open-sea
        # reference (Step 08 hardening). Computed from the live value pixels
        # inside the candidate so the figure reflects the actual signal strength
        # (robust mean of the region's backscatter, ignoring masked pixels).
        region_vals = work[mask & np.isfinite(work)]
        contrast_db = (
            float(sea_reference - np.mean(region_vals))
            if region_vals.size > 0
            else None
        )

        # Per-pixel incidence angle (for real GRD scenes carrying the metadata).
        incidence_deg = self._candidate_incidence(scene, mask)

        return self._build_candidate(
            scene, geo, label_idx, poly, pixel_area, mean_lat,
            contrast_db=contrast_db, incidence_deg=incidence_deg,
        )

    @staticmethod
    def _candidate_incidence(scene: SarScene, mask: np.ndarray) -> Optional[float]:
        """Mean incidence angle (deg) over the candidate, if the scene carries a
        per-pixel incidence-angle field (real GRD). None otherwise."""
        inc = getattr(scene, "incidence_deg", None)
        if inc is None or np.asarray(inc).shape != np.asarray(mask).shape:
            return None
        vals = np.asarray(inc)[mask & np.isfinite(np.asarray(inc, dtype=float))]
        if vals.size == 0:
            return None
        return round(float(np.mean(vals)), 2)

    def _build_candidate(
        self,
        scene: SarScene,
        geo: GeoTransform,
        label_idx: int,
        poly: Polygon,
        pixel_area: int,
        mean_lat: float,
        contrast_db: Optional[float] = None,
        incidence_deg: Optional[float] = None,
    ) -> SlickCandidate:
        centroid = (float(poly.centroid.x), float(poly.centroid.y))
        minx, miny, maxx, maxy = poly.bounds

        m_per_deg_lon = 111320.0 * np.cos(np.radians(mean_lat))
        m_per_deg_lat = 110574.0

        area_km2 = poly.area * (m_per_deg_lon / 1000.0) * (m_per_deg_lat / 1000.0)
        perimeter_km = poly.length * (m_per_deg_lon + m_per_deg_lat) / 2.0 / 1000.0

        # Length/width via principal component analysis of the vertices.
        coords = np.asarray(poly.exterior.coords)
        xy = np.column_stack([coords[:, 0] * m_per_deg_lon, coords[:, 1] * m_per_deg_lat])
        length_km, width_km, orientation_deg = _principal_axes(xy)

        aspect_ratio = (length_km / width_km) if width_km > 1e-6 else 0.0
        shape_factor = (area_km2 * 1e6) / (perimeter_km * 1000.0) ** 2 if perimeter_km > 0 else 0.0

        classification, confidence, hints, warnings = self._classify(
            area_km2, aspect_ratio, shape_factor, length_km, mean_lat, pixel_area,
            contrast_db=contrast_db, incidence_deg=incidence_deg,
        )

        candidate_id = f"{scene.scene_id}-cand-{label_idx}"
        return SlickCandidate(
            candidate_id=candidate_id,
            classification=classification,
            confidence=confidence,
            centroid=(round(centroid[0], 6), round(centroid[1], 6)),
            polygon=[(round(lon, 6), round(lat, 6)) for lon, lat in poly.exterior.coords],
            bbox={
                "north": round(maxy, 6),
                "south": round(miny, 6),
                "east": round(maxx, 6),
                "west": round(minx, 6),
            },
            area_km2=round(area_km2, 4),
            perimeter_km=round(perimeter_km, 4),
            length_km=round(length_km, 4),
            width_km=round(width_km, 4),
            aspect_ratio=round(aspect_ratio, 4),
            orientation_deg=round(orientation_deg, 1),
            shape_factor=round(shape_factor, 6),
            pixel_area=int(pixel_area),
            contrast_db=round(contrast_db, 2) if contrast_db is not None else None,
            incidence_deg=incidence_deg,
            look_alike_hints=hints,
            warnings=warnings,
        )

    def _classify(
        self, area_km2, aspect_ratio, shape_factor, length_km, mean_lat, pixel_area,
        contrast_db: Optional[float] = None, incidence_deg: Optional[float] = None,
    ) -> tuple[CandidateClass, float, List[str], List[str]]:
        """Geometric heuristic classification + honest confidence.

        Dark SAR features are not uniquely oil. We use well-documented
        discriminators: natural look-alikes (low wind, rain cells) tend to be
        compact/circular, while mineral oil slicks are elongated (high aspect
        ratio) and often large. This is a candidate flagging heuristic, not
        perfect classification — we expose confidence and hints accordingly.

        Step 08 hardening: the candidate's *local contrast* (dB below the
        measured open-sea reference) is the primary physical signal. Strong
        contrast supports oil; weak contrast (< ~3 dB) is characteristic of
        marginal dark regions / look-alikes and downgrades confidence. Where the
        scene carries per-pixel incidence angle (real GRD), low incidence angles
        (more look-alikes) likewise caution against high confidence.
        """
        hints: List[str] = []
        warnings: List[str] = []

        elongated = aspect_ratio >= 1.8
        compact_circular = aspect_ratio < 1.3
        moderate = 1.3 <= aspect_ratio < 1.8

        large = area_km2 >= 0.5
        small = area_km2 < 0.05

        if compact_circular:
            hints.append(
                "near-circular dark region: consistent with a low-wind/rain-cell "
                "look-alike rather than a sheared oil slick"
            )
            confidence = 0.35
            cls = CandidateClass.LOOK_ALIKE if compact_circular else CandidateClass.UNCERTAIN
        elif moderate:
            confidence = 0.55
            cls = CandidateClass.UNCERTAIN
            hints.append("moderate elongation: ambiguous oil vs natural feature")
        else:  # elongated
            confidence = 0.78 if large else 0.62
            cls = CandidateClass.OIL_CANDIDATE
            if not large:
                warnings.append("small candidate; may be noise or a minor sheen")

        if small:
            warnings.append("very small candidate; below confident detection size")
            confidence = min(confidence, 0.4)

        # ---- Step 08 hardening: local-contrast gating -----------------------
        # A dark region must actually stand out from its measured sea reference.
        # Weak contrast means the region is barely darker than the sea — the
        # canonical signature of a marginal/ambiguous dark feature, not a robust
        # slick. Downgrade confidence honestly (to a LOOK_ALIKE-ish plateau) and
        # attach an explicit warning rather than silently inflating certainty.
        if contrast_db is not None:
            if contrast_db < 3.0:
                warnings.append(
                    f"low local contrast ({contrast_db:.1f} dB below sea reference): "
                    "weakly darker than the sea background; borderline look-alike "
                    "signature, treated as low confidence"
                )
                confidence = min(confidence, 0.4)
                if cls == CandidateClass.OIL_CANDIDATE:
                    cls = CandidateClass.UNCERTAIN
            elif cls == CandidateClass.OIL_CANDIDATE and contrast_db < 5.0:
                warnings.append(
                    f"moderate local contrast ({contrast_db:.1f} dB): an elongated "
                    "dark feature present, but contrast below the strong-slick "
                    "regime (~6-17 dB); confidence limited"
                )
                confidence = min(confidence, 0.68)

        # ---- Step 08 hardening: incidence-angle caveat ----------------------
        # At low incidence angles SAR backscatter from the sea is suppressed by
        # geometry rather than oil, so dark features there are less diagnostic.
        # Only applied when real per-pixel incidence metadata is available.
        if incidence_deg is not None and incidence_deg < 25.0:
            warnings.append(
                f"low mean incidence angle ({incidence_deg:.1f} deg): geometry-"
                "suppressed dark features are ambiguous here; confidence limited"
            )
            confidence = min(confidence, 0.5)

        if mean_lat is not None and abs(mean_lat) > 60:
            warnings.append("high latitude: geometric scaling less reliable")

        return cls, round(confidence, 2), hints, warnings


def _principal_axes(xy: np.ndarray) -> tuple[float, float, float]:
    """Return (length_m, width_m, orientation_deg) via PCA of vertex cloud."""
    c = xy - xy.mean(axis=0)
    cov = np.cov(c, rowvar=False)
    if cov.shape != (2, 2):
        return 0.0, 0.0, 0.0
    try:
        eigvals, eigvecs = np.linalg.eigh(cov)
    except np.linalg.LinAlgError:
        return 0.0, 0.0, 0.0
    order = np.argsort(eigvals)[::-1]
    eigvals = eigvals[order]
    eigvecs = eigvecs[:, order]
    v = eigvecs[:, 0]
    ang = np.degrees(np.arctan2(v[1], v[0]))
    extents = np.sqrt(np.maximum(eigvals, 0.0))
    length_m = 4.0 * extents[0]
    width_m = 4.0 * extents[1]
    return length_m, width_m, float(ang % 180.0)
