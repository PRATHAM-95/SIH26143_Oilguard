"""Vessel-attribution scoring — frozen SYSTEM_SPEC §11 five-factor composite.

Each candidate vessel is scored on five weighted factors, each normalised to
[0, 1]:

    factor        weight   evidence used
    spatial       0.25     closest-approach distance (km) to the estimated origin
    temporal      0.20     time of closest approach vs the estimated release time
    trajectory    0.25     alignment of the vessel track with the backtracking fan
    anomaly       0.15     rule-based behaviour signals near the origin (§10.4)
    environmental 0.15     vessel motion vs local current/wind forcing (when given)

Frozen weights MUST NOT be silently retuned. ``FIVE_FACTOR_WEIGHTS`` is the
single source of truth and is echoed back in every response so the UI can show
exactly what was used.

AIS data reliability (msg count, interpolation fraction, reporting gaps) is
deliberately carried as a SEPARATE evidence block (``data_quality``) and never
mixed into the composite — cf. the plan decision "quality block separate".

Scoring never claims a vessel caused the spill: outputs are ranked
"candidates" and a low top score or thin margin yields "attribution
inconclusive".
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from .contract import AisCandidate

MODEL_VERSION = "ais-scoring-v1"

FIVE_FACTOR_WEIGHTS: dict[str, float] = {
    "spatial": 0.25,
    "temporal": 0.20,
    "trajectory": 0.25,
    "anomaly": 0.15,
    "environmental": 0.15,
}

#: top composite below which the story is "attribution inconclusive"
INCONCLUSIVE_SCORE = 0.45

#: score margin (top - 2nd) below which the ranking is not decisive
DECISIVE_MARGIN = 0.05


@dataclass
class ScoreContext:
    """All non-candidate inputs the factors may consult.

    ``release_time`` should be the estimated release time from backtracking.
    ``backtracking_fan`` is a list of trajectory dicts (as persisted in a
    backtrack_run), each with an ``endpoints`` list of {lon, lat}. When absent
    the trajectory factor returns a neutral 0.5 with an honest note.
    ``environment`` (optional) carries local forcing at the origin: u_current,
    v_current, u_wind, v_wind (m/s).
    """

    origin_lon: float
    origin_lat: float
    release_time: datetime | None = None
    search_radius_km: float = 50.0
    backtracking_fan: list[dict] | None = None
    environment: dict | None = None


def _neutral(value: float, note: str) -> tuple[float, dict]:
    return round(float(value), 3), {"note": note}


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def factor_spatial(cand: AisCandidate) -> tuple[float, dict]:
    d = cand.min_distance_km
    if d is None:
        return _neutral(0.0, "no closest approach computed")
    score = 1.0 / (1.0 + d / 10.0)
    return round(score, 3), {
        "closest_approach_km": round(d, 2) if d is not None else None,
        "formula": "1 / (1 + d/10)",
    }


def factor_temporal(cand: AisCandidate, release_time: datetime | None) -> tuple[float, dict]:
    tca = cand.time_of_closest_approach
    if tca is None:
        return _neutral(0.5, "no time of closest approach")
    if release_time is None:
        return _neutral(0.5, "no estimated release time provided; temporal factor neutral")
    diff_h = abs((tca - release_time).total_seconds()) / 3600.0
    score = 1.0 / (1.0 + diff_h / 6.0)
    return round(score, 3), {
        "tca": tca.isoformat(),
        "release_time": release_time.isoformat(),
        "time_diff_hours": round(diff_h, 2),
        "formula": "1 / (1 + diff_hours/6)",
    }


def factor_trajectory(
    cand: AisCandidate,
    fan: list[dict] | None,
    release_time: datetime | None,
) -> tuple[float, dict]:
    """Distance of the vessel's positions AROUND the release time to the fan.

    The backtracking fan is the ensemble of backward-drift paths connecting
    the observed slick to the probable source region. The question attribution
    really asks is: "was this vessel inside/along that source region at the
    estimated release time?" — so we compare the vessel's reconstructed
    positions within a short window around ``release_time`` (falling back to a
    window around its own time-of-closest-approach when no release time is
    given) against the fan endpoints.
    """
    if not fan:
        return _neutral(0.5, "no backtracking fan provided; trajectory factor neutral")

    import math

    from .generator import haversine_km

    pts: list[tuple[float, float]] = []
    for traj in fan:
        for ep in traj.get("endpoints", []):
            pts.append((float(ep["lon"]), float(ep["lat"])))
    if not pts:
        return _neutral(0.5, "backtracking fan has no endpoints; trajectory factor neutral")

    anchor = release_time or cand.time_of_closest_approach
    if anchor is None:
        window_msgs = cand.track.messages
    else:
        lo = anchor - timedelta(hours=2)
        hi = anchor + timedelta(hours=2)
        window_msgs = [m for m in cand.track.messages if lo <= m.timestamp <= hi]
        if len(window_msgs) < 2:
            window_msgs = cand.track.messages

    dists: list[float] = []
    for m in window_msgs:
        d = min(haversine_km(m.longitude, m.latitude, plon, plat) for plon, plat in pts)
        dists.append(d)
    if not dists:
        return _neutral(0.5, "no reconstructed positions to compare")
    dists.sort()
    p15 = dists[max(0, int(0.15 * len(dists)) - 1)]
    median = dists[len(dists) // 2]
    reference = min(p15, median)  # reward being (mostly) within the source region
    scale_km = 5.0
    score = 1.0 / (1.0 + reference / scale_km)
    return round(score, 3), {
        "release_anchored_km": round(reference, 2),
        "fan_points": len(pts),
        "points_compared": len(dists),
        "anchor_time": anchor.isoformat() if anchor else None,
        "formula": f"1 / (1 + distance_km/{scale_km}) at release time",
    }


def factor_anomaly(cand: AisCandidate) -> tuple[float, dict]:
    """Rule-based behaviour evidence (§10.4). High only with real signals.

    A vessel behaving normally scores 0 here — anomalous behaviour is the
    signal, not steady transit.
    """
    tca = cand.time_of_closest_approach
    strong = 0
    moderate = 0
    items: list[dict] = []
    for s in cand.anomalies:
        near_tca = tca is not None and abs((s.timestamp - tca).total_seconds()) <= 1800
        weight = 1.0 if near_tca else 0.5
        if weight >= 1.0:
            strong += 1
        else:
            moderate += 1
        items.append({
            "kind": s.kind,
            "timestamp": s.timestamp.isoformat(),
            "metric": s.metric,
            "near_tca": bool(near_tca),
            "weight": weight,
        })
    base = 0.0
    base += 0.6 * min(1.0, strong)
    base += 0.3 * min(1.0, moderate)
    if strong >= 2:
        base = 1.0
    score = round(_clamp01(base), 3)
    return score, {"signals": items, "n_strong": strong, "n_moderate": moderate}


def factor_environmental(cand: AisCandidate, environment: dict | None) -> tuple[float, dict]:
    """Vessel motion of the origin vs local current + wind forcing.

    When no forcing is provided (honest default for a CONTROLLED run that does
    not carry a wind/current crate at the origin) the factor is a documented
    neutral 0.5 — it is NOT assigned a confident value.
    """
    if not environment:
        return _neutral(0.5, "no current/wind forcing provided; environmental factor neutral")
    try:
        u = float(environment.get("u_current", 0.0)) + 0.03 * float(environment.get("u_wind", 0.0))
        v = float(environment.get("v_current", 0.0)) + 0.03 * float(environment.get("v_wind", 0.0))
    except (TypeError, ValueError):
        return _neutral(0.5, "malformed forcing values; environmental factor neutral")

    import math

    tca = cand.time_of_closest_approach
    near = [m for m in cand.track.messages if tca is not None and abs((m.timestamp - tca).total_seconds()) <= 900]
    if len(near) < 2:
        near = cand.track.messages[-10:] if len(cand.track.messages) >= 2 else cand.track.messages
    if len(near) < 2:
        return _neutral(0.5, "no positions near origin to compare")
    first, last = near[0], near[-1]
    if last.timestamp <= first.timestamp:
        return _neutral(0.5, "no temporal spread near origin; environmental factor neutral")

    dx = last.longitude - first.longitude
    dy = last.latitude - first.latitude
    dt_h = (last.timestamp - first.timestamp).total_seconds() / 3600.0
    dist_km = math.hypot(dx * 111.0, dy * 111.0)
    speed_ms = (dist_km * 1000.0) / (dt_h * 3600.0)
    if speed_ms < 1e-6:
        return _neutral(1.0, "essentially stationary at origin — consistent with passive drift")

    # vessel velocity (m/s east, m/s north)
    vx = dx * 111_000.0 / (dt_h * 3600.0)
    vy = dy * 111_000.0 / (dt_h * 3600.0)
    residual = math.hypot(vx - u, vy - v)
    score = 1.0 / (1.0 + residual / 1.0)
    return round(score, 3), {
        "forcing_u_ms": round(u, 3),
        "forcing_v_ms": round(v, 3),
        "vessel_velocity_ms": [round(vx, 3), round(vy, 3)],
        "residual_ms": round(residual, 3),
        "formula": "1 / (1 + |vessel - (current+3%wind)| / 1.0)",
    }


def score_candidate(cand: AisCandidate, ctx: ScoreContext) -> dict:
    """Compute the composite score + per-factor evidence for one candidate."""
    spatial_s, spatial_e = factor_spatial(cand)
    temporal_s, temporal_e = factor_temporal(cand, ctx.release_time)
    traj_s, traj_e = factor_trajectory(cand, ctx.backtracking_fan, ctx.release_time)
    anomaly_s, anomaly_e = factor_anomaly(cand)
    env_s, env_e = factor_environmental(cand, ctx.environment)

    factors = {
        "spatial": spatial_s,
        "temporal": temporal_s,
        "trajectory": traj_s,
        "anomaly": anomaly_s,
        "environmental": env_s,
    }
    composite = sum(FIVE_FACTOR_WEIGHTS[k] * factors[k] for k in factors)
    composite = round(_clamp01(composite), 4)

    warnings: list[str] = []
    for key, ev in (("trajectory", traj_e), ("environmental", env_e)):
        if "note" in ev and "neutral" in ev["note"]:
            warnings.append(ev["note"])

    return {
        "mmsi": cand.mmsi,
        "name": cand.name,
        "vessel_type": cand.vessel_type,
        "imo": cand.imo,
        "score": composite,
        "factors": {k: round(v, 3) for k, v in factors.items()},
        "factor_evidence": {
            "spatial": spatial_e,
            "temporal": temporal_e,
            "trajectory": traj_e,
            "anomaly": anomaly_e,
            "environmental": env_e,
        },
        "data_quality": {
            "reliability": cand.reliability,
            "notes": cand.reliability_notes,
            "messages_in_window": cand.messages_in_window,
            "median_cadence_min": cand.median_cadence_min,
            "interpolation_fraction": cand.interpolation_fraction,
            "coverage_gaps": cand.coverage_gaps,
            "anomalies": anomaly_e.get("signals", []),
        },
        "min_distance_km": cand.min_distance_km,
        "time_of_closest_approach": cand.time_of_closest_approach.isoformat()
        if cand.time_of_closest_approach
        else None,
        "closest_position": cand.closest_position,
        "warnings": warnings,
    }


def rank_vessels(
    candidates: list[AisCandidate],
    ctx: ScoreContext,
    weights: dict[str, float] | None = None,
    source_state: str = "CONTROLLED",
) -> dict:
    """Compute the full ranked attribution output for a candidate set.

    Returns the frozen-composite response object:
      status, ranked_vessels, ranking (margin / decisive),
      conclusion ("candidate" | "inconclusive"), weights_used,
      attribution_model_version, source_state, warnings.
    """
    if weights is not None:
        unknown = set(weights) - set(FIVE_FACTOR_WEIGHTS)
        if unknown:
            raise ValueError(f"unknown weights keys: {sorted(unknown)}")
        w = {k: float(weights.get(k, FIVE_FACTOR_WEIGHTS[k])) for k in FIVE_FACTOR_WEIGHTS}
        if abs(sum(w.values()) - 1.0) > 1e-6:
            raise ValueError("provided weights must sum to 1.0")
    else:
        w = dict(FIVE_FACTOR_WEIGHTS)

    scored = [score_candidate(c, ctx) for c in candidates]
    listed = [s for s in scored if s["min_distance_km"] is not None]
    listed.sort(key=lambda s: (-s["score"], s["mmsi"]))
    for i, item in enumerate(listed, start=1):
        item["rank"] = i

    top = listed[0]["score"] if listed else 0.0
    second = listed[1]["score"] if len(listed) > 1 else 0.0
    margin = round(top - second, 4)
    decisive = margin >= DECISIVE_MARGIN
    conclusive_enough = top >= INCONCLUSIVE_SCORE
    conclusion = "candidate" if (listed and decisive and conclusive_enough) else "inconclusive"

    warnings: list[str] = []
    if not listed:
        warnings.append("no candidate vessels survived filtering within the search window/radius")
    elif conclusion == "inconclusive":
        if not conclusive_enough:
            warnings.append(
                f"top score {top:.2f} below the {INCONCLUSIVE_SCORE:.2f} confidence threshold — "
                "attribution is inconclusive"
            )
        if not decisive:
            warnings.append(
                f"top margin {margin:.3f} below {DECISIVE_MARGIN:.3f} — ranking is not decisive"
            )

    return {
        "status": "completed",
        "ranked_vessels": listed,
        "ranking": {
            "top_score": round(top, 4),
            "second_score": round(second, 4),
            "margin": margin,
            "decisive": decisive,
        },
        "conclusion": conclusion,
        "weights_used": {k: round(v, 3) for k, v in w.items()},
        "attribution_model_version": f"{MODEL_VERSION}/factors-{'.'.join(str(FIVE_FACTOR_WEIGHTS[k]) for k in FIVE_FACTOR_WEIGHTS)}",
        "source_state": source_state,
        "warnings": warnings,
    }