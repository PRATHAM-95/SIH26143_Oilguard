"""Temporal/spatial filtering + trajectory reconstruction for AIS candidates.

Implements the SYSTEM_SPEC §10.3 stages between a raw provider query and the
scoring step, deterministically and with an explicit audit trail:

1. window   — keep messages inside the attribution time window (frozen ±48 h
              search by default) and strictly ordered by time;
2. spatial  — keep vessels that actually come within the search radius;
3. reconstruct — fill short reporting gaps with great-circle interpolation
              (≤ ``max_gap_min``, e.g. 30) and flag longer gaps;
4. anomalies — rule-based detection (frozen §10.4) → AnomalySignal set;
5. candidate — AisCandidate with per-vessel data-quality evidence carried
              SEPARATELY from the composite score (see scoring.py).

Nothing here reaches out to a real provider; ground truth never enters.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .contract import AisCandidate, AisMessage, AisTrack, AnomalySignal
from .generator import haversine_km

#: longest implicit gap we will *interpolate* across (frozen §10.3 > 30 min = gap)
DEFAULT_MAX_GAP_MIN = 30.0

#: cap on interpolated points inserted into a single gap (keeps payload sane)
MAX_INTERPOLATION_PER_GAP = 6


@dataclass
class FilterOutcome:
    candidates: list[AisCandidate] = field(default_factory=list)
    dropped: list[dict] = field(default_factory=list)
    stats: dict = field(default_factory=dict)


def window_track(track: AisTrack, start: datetime, end: datetime) -> list[AisMessage]:
    msgs = [m for m in track.messages if start <= m.timestamp <= end]
    msgs.sort(key=lambda m: m.timestamp)
    return msgs


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def median_cadence_min(messages: list[AisMessage]) -> float:
    deltas = [
        (b.timestamp - a.timestamp).total_seconds() / 60.0
        for a, b in zip(messages, messages[1:])
        if b.timestamp > a.timestamp
    ]
    return round(_median(deltas), 2) if deltas else 0.0


def _interpolate_between(a: AisMessage, b: AisMessage, fractions: list[float]) -> list[AisMessage]:
    out = []
    for f in fractions:
        out.append(
            AisMessage(
                timestamp=a.timestamp + (b.timestamp - a.timestamp) * f,
                longitude=round(a.longitude + f * (b.longitude - a.longitude), 6),
                latitude=round(a.latitude + f * (b.latitude - a.latitude), 6),
                speed_knots=round(a.speed_knots + f * (b.speed_knots - a.speed_knots), 2),
                course_deg=round(a.course_deg + f * (b.course_deg - a.course_deg), 1),
                heading_deg=round(a.heading_deg + f * (b.heading_deg - a.heading_deg), 1),
                interpolated=True,
            )
        )
    return out


def reconstruct_track(
    messages: list[AisMessage], *, max_gap_min: float = DEFAULT_MAX_GAP_MIN
) -> tuple[list[AisMessage], int, int]:
    """Return (reconstructed series, interpolated_count, coverage_gap_count)."""
    if not messages:
        return [], 0, 0
    cadence = median_cadence_min(messages) or 5.0
    cadence = max(1.0, cadence)
    out: list[AisMessage] = []
    interpolated = 0
    gaps = 0
    for i, m in enumerate(messages):
        out.append(m)
        if i == len(messages) - 1:
            break
        nxt = messages[i + 1]
        gap_min = (nxt.timestamp - m.timestamp).total_seconds() / 60.0
        if gap_min > max_gap_min:
            gaps += 1
            continue
        n = min(MAX_INTERPOLATION_PER_GAP, max(0, int(round(gap_min / cadence)) - 1))
        if n:
            fractions = [(k + 1) / (n + 1) for k in range(n)]
            out.extend(_interpolate_between(m, nxt, fractions))
            interpolated += n
    return out, interpolated, gaps


def closest_approach(
    series: list[AisMessage], lon: float, lat: float
) -> tuple[float | None, datetime | None, AisMessage | None]:
    """(min_distance_km, time_of_closest_approach, closest_message)."""
    best: tuple[float | None, datetime | None, AisMessage | None] = (None, None, None)
    for m in series:
        d = haversine_km(m.longitude, m.latitude, lon, lat)
        if best[0] is None or d < best[0]:
            best = (d, m.timestamp, m)
    return best


def _implied_speed_kn(a: AisMessage, b: AisMessage) -> float:
    d_km = haversine_km(a.longitude, a.latitude, b.longitude, b.latitude)
    dt_h = (b.timestamp - a.timestamp).total_seconds() / 3600.0
    return d_km / dt_h if dt_h > 0 else 0.0


def detect_anomalies(
    series: list[AisMessage],
    origin_lon: float,
    origin_lat: float,
    proximity_km: float = 15.0,
) -> list[AnomalySignal]:
    """Rule-based anomaly detection (frozen §10.4). Deterministic.

    Only pays attention to the vessel's behaviour NEAR the origin (within
    ``proximity_km``) — behaviour far away is irrelevant to attribution.
    """
    signals: list[AnomalySignal] = []
    near = [m for m in series if haversine_km(m.longitude, m.latitude, origin_lon, origin_lat) <= proximity_km]
    if len(near) < 2:
        return signals

    speeds = sorted(m.speed_knots for m in near)
    p95 = speeds[max(0, int(0.95 * len(speeds)) - 1)]

    # 1. sustained speed drop (>65% below the vessel's own 95th percentile).
    run = 0
    run_start = near[0].timestamp
    for m in near:
        if p95 > 0 and m.speed_knots <= 0.35 * p95:
            if run == 0:
                run_start = m.timestamp
            run += 1
        else:
            if run >= 3:
                signals.append(AnomalySignal(
                    kind="speed_drop",
                    timestamp=run_start,
                    metric=round(m.speed_knots / p95, 3) if p95 else 0.0,
                    detail=f"speed fell to {run_start.strftime('%H:%M')} over {run} reports near origin",
                ))
            run = 0
    if run >= 3:
        signals.append(AnomalySignal(
            kind="speed_drop", timestamp=run_start, metric=0.0,
            detail=f"sustained low speed over {run} reports near origin",
        ))

    # 2. loitering: mean speed <= 1.0 kn over any 30-minute stretch near origin.
    for i, m in enumerate(near):
        window = [x for x in near if m.timestamp <= x.timestamp <= m.timestamp + timedelta(minutes=30)]
        if len(window) >= 3:
            mean = sum(x.speed_knots for x in window) / len(window)
            if mean <= 1.0:
                signals.append(AnomalySignal(
                    kind="loiter",
                    timestamp=m.timestamp,
                    metric=round(mean, 2),
                    detail=f"mean speed {mean:.2f} kn over 30 min near origin",
                ))
                break

    # 3. reporting gaps near origin (transponder off / silent vessel).
    for i, m in enumerate(near):
        if i == len(near) - 1:
            break
        nxt = near[i + 1]
        gap_min = (nxt.timestamp - m.timestamp).total_seconds() / 60.0
        if gap_min > DEFAULT_MAX_GAP_MIN:
            signals.append(AnomalySignal(
                kind="reporting_gap",
                timestamp=m.timestamp,
                metric=round(gap_min, 1),
                detail=f"AIS reporting gap of {gap_min:.0f} min near origin",
            ))

    # 4. sharp sustained heading deviation near origin.
    for i in range(1, len(near) - 1):
        a, b, c = near[i - 1], near[i], near[i + 1]
        d1 = (b.course_deg - a.course_deg + 540) % 360 - 180
        d2 = (c.course_deg - b.course_deg + 540) % 360 - 180
        if abs(d1) >= 60 and abs(d2) >= 60:
            signs_match = (d1 > 0) == (d2 > 0)
            if signs_match:
                signals.append(AnomalySignal(
                    kind="heading_deviation",
                    timestamp=b.timestamp,
                    metric=max(abs(d1), abs(d2)),
                    detail=f"course swung {abs(d1):.0f} then {abs(d2):.0f} deg near origin",
                ))
                break

    return signals


def classify_reliability(
    messages_in_window: int,
    median_cadence: float,
    interpolation_fraction: float,
    coverage_gaps: int,
) -> tuple[str, list[str]]:
    """Rule-based AIS data-quality grading (evidence block, NOT part of score)."""
    notes: list[str] = []
    drops = 0
    if messages_in_window < 4:
        drops += 1
        notes.append("sparse position series in search window")
    if median_cadence > 15:
        drops += 1
        notes.append(f"median reporting cadence {median_cadence:.0f} min is sparse")
    if interpolation_fraction > 0.45:
        drops += 1
        notes.append(f"{interpolation_fraction * 100:.0f}% of positions are reconstructed (interpolated)")
    elif interpolation_fraction > 0:
        notes.append(f"{interpolation_fraction * 100:.0f}% of positions are reconstructed")
    if coverage_gaps > 0:
        drops += 1
        notes.append(f"{coverage_gaps} AIS reporting gap(s) > {DEFAULT_MAX_GAP_MIN:.0f} min in window")
    if drops == 0:
        return "HIGH", notes or ["dense, gap-free AIS series"]
    if drops == 1:
        return "MEDIUM", notes
    return "LOW", notes


def build_candidate(
    track: AisTrack,
    origin_lon: float,
    origin_lat: float,
    window_start: datetime,
    window_end: datetime,
    radius_km: float,
    max_gap_min: float = DEFAULT_MAX_GAP_MIN,
) -> AisCandidate | None:
    """Construct an AisCandidate for a raw track, or None if it must be dropped."""
    in_window = window_track(track, window_start, window_end)
    if len(in_window) < 2:
        return None

    recon, interp_count, gap_count = reconstruct_track(in_window, max_gap_min=max_gap_min)
    min_km, tca, closest_msg = closest_approach(recon, origin_lon, origin_lat)
    if min_km is None or min_km > radius_km:
        return None

    interp_frac = round(interp_count / max(1, len(in_window) + interp_count), 3)
    cadence = median_cadence_min(in_window)
    reliability, notes = classify_reliability(
        len(in_window), cadence, interp_frac, gap_count
    )
    anomalies = detect_anomalies(recon, origin_lon, origin_lat)
    smoothed = AisTrack(
        mmsi=track.mmsi,
        name=track.name,
        vessel_type=track.vessel_type,
        imo=track.imo,
        length_m=track.length_m,
        beam_m=track.beam_m,
        draft_m=track.draft_m,
        messages=recon,
        source_state=track.source_state,
        provider=track.provider,
        dataset=track.dataset,
        generator_seed=track.generator_seed,
    )
    return AisCandidate(
        mmsi=track.mmsi,
        name=track.name,
        vessel_type=track.vessel_type,
        imo=track.imo,
        track=smoothed,
        messages_in_window=len(in_window),
        median_cadence_min=cadence,
        interpolation_fraction=interp_frac,
        coverage_gaps=gap_count,
        min_distance_km=round(min_km, 3),
        time_of_closest_approach=tca,
        closest_position=None
        if closest_msg is None
        else {"lon": closest_msg.longitude, "lat": closest_msg.latitude},
        anomalies=anomalies,
        reliability=reliability,
        reliability_notes=notes,
    )


def filter_candidates(
    tracks: list[AisTrack],
    origin_lon: float,
    origin_lat: float,
    window_start: datetime,
    window_end: datetime,
    radius_km: float,
    max_gap_min: float = DEFAULT_MAX_GAP_MIN,
) -> FilterOutcome:
    """AIS filter stage: window → spatial → reconstruction → candidates.

    Dropped vessels are recorded with explicit reasons so the attribution
    evidence trail is fully auditable.
    """
    outcome = FilterOutcome()
    for track in tracks:
        in_window = window_track(track, window_start, window_end)
        if len(in_window) < 2:
            outcome.dropped.append({
                "mmsi": track.mmsi,
                "name": track.name,
                "reasons": ["no position series inside the search window"],
            })
            continue
        recon, _i, gap_count = reconstruct_track(in_window, max_gap_min=max_gap_min)
        min_km, _tca, _m = closest_approach(recon, origin_lon, origin_lat)
        if min_km is None or min_km > radius_km:
            outcome.dropped.append({
                "mmsi": track.mmsi,
                "name": track.name,
                "reasons": [f"closest approach {min_km:.1f} km outside search radius {radius_km:.0f} km"],
            })
            continue
        cand = build_candidate(track, origin_lon, origin_lat, window_start, window_end, radius_km, max_gap_min)
        if cand is not None:
            outcome.candidates.append(cand)
    outcome.stats = {
        "input_vessels": len(tracks),
        "kept": len(outcome.candidates),
        "dropped": len(outcome.dropped),
        "dropped_reasons": [d["reasons"][0] for d in outcome.dropped],
    }
    return outcome