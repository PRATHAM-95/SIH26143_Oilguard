"""Self-contained marching-squares contour tracing (no scikit-image needed).

Computes ordered iso-contours of a boolean/float array. Used by the classical
detector to turn a detected region mask into a smooth outer polygon ring.
"""

from __future__ import annotations

from typing import List

import numpy as np


def _interp(v0, v1, level):
    """Linear interpolation factor between two vertex values at ``level``."""
    if abs(v1 - v0) < 1e-12:
        return 0.5
    return (level - v0) / (v1 - v0)


def _edge_points(values, level):
    """Return border intersection points for a 2x2 cell as [x, y] pairs.

    values is 4 corners [v00, v10, v11, v01]. The cell is indexed by (row,col);
    x is the column axis, y the row axis.
    """
    v00, v10, v11, v01 = values
    t = _interp
    pts = {}
    # top edge (row = y top): between v00 (col0) and v10 (col1)
    if (v00 - level) * (v10 - level) < 0:
        f = t(v00, v10, level)
        pts["top"] = (0.0 + f, 0.0)
    # bottom edge: between v01 and v11
    if (v01 - level) * (v11 - level) < 0:
        f = t(v01, v11, level)
        pts["bottom"] = (0.0 + f, 1.0)
    # left edge: between v00 and v01
    if (v00 - level) * (v01 - level) < 0:
        f = t(v00, v01, level)
        pts["left"] = (0.0, 0.0 + f)
    # right edge: between v10 and v11
    if (v10 - level) * (v11 - level) < 0:
        f = t(v10, v11, level)
        pts["right"] = (1.0, 0.0 + f)
    return pts


def _segments_in_cell(pts):
    """Return 0/2 border points (the segment crossing this cell)."""
    if len(pts) != 2:
        return []
    return list(pts.values())


def find_contours(array: np.ndarray, level: float = 0.5) -> List[np.ndarray]:
    """Trace iso-contours of ``array`` (float) at ``level``.

    Returns a list of (N, 2) float arrays in (col, row) coordinates, e.g.
    matching the shape of ``skimage.measure.find_contours`` output. Segments
    are chained into ordered contours.
    """
    arr = np.asarray(array, dtype=float)
    if arr.ndim != 2:
        raise ValueError("find_contours expects a 2-D array")
    rows, cols = arr.shape
    segments = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            pts = _edge_points(
                (arr[r, c], arr[r, c + 1], arr[r + 1, c + 1], arr[r + 1, c]),
                level,
            )
            seg = _segments_in_cell(pts)
            if seg:
                a = (c + seg[0][0], r + seg[0][1])
                b = (c + seg[1][0], r + seg[1][1])
                segments.append((a, b))

    if not segments:
        return []

    # Chain segments into ordered contours.
    remaining = set(range(len(segments)))
    contours: List[np.ndarray] = []
    while remaining:
        start = next(iter(remaining))
        chain = [segments[start][0], segments[start][1]]
        remaining.discard(start)
        grew = True
        while grew and remaining:
            grew = False
            tail = chain[-1]
            for idx in list(remaining):
                a, b = segments[idx]
                if _close(a, tail):
                    chain.append(b)
                    remaining.discard(idx)
                    grew = True
                    break
                if _close(b, tail):
                    chain.append(a)
                    remaining.discard(idx)
                    grew = True
                    break
        if len(chain) > 2:
            contours.append(np.asarray(chain, dtype=float))
    return contours


def _close(a, b, eps: float = 1e-6) -> bool:
    return abs(a[0] - b[0]) < eps and abs(a[1] - b[1]) < eps
