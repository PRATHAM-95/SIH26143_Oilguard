"""Filtering: window, spatial, reconstruction, quality evidence, drops."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

from app.ais.contract import AisMessage, AisTrack, AisSourceState
from app.ais.filters import (
    DEFAULT_MAX_GAP_MIN,
    build_candidate,
    classify_reliability,
    closest_approach,
    detect_anomalies,
    filter_candidates,
    median_cadence_min,
    reconstruct_track,
    window_track,
)

T0 = datetime(2026, 8, 4, 0, 0, 0, tzinfo=timezone.utc)


def _msg(i, lon=72.4, lat=15.0, speed=10.0, course=60.0, step_min=5):
    return AisMessage(
        timestamp=T0 + timedelta(minutes=i * step_min),
        longitude=lon + i * 0.01,
        latitude=lat,
        speed_knots=speed,
        course_deg=course,
        heading_deg=course,
        interpolated=False,
    )


def _track(messages, mmsi="1001"):
    return AisTrack(
        mmsi=mmsi, name=f"MV {mmsi}", vessel_type="CARGO",
        messages=messages, source_state=AisSourceState.CONTROLLED,
        provider="CONTROLLED", dataset="controlled-ais-v1",
    )


def test_window_track_filters_and_sorts():
    msgs = [_msg(0), _msg(20), _msg(5), _msg(40)]
    got = window_track(_track(msgs), T0 + timedelta(minutes=0), T0 + timedelta(minutes=25))
    assert [m.timestamp.minute for m in got] == [0, 25]


def test_median_cadence():
    msgs = [_msg(i) for i in range(10)]
    assert median_cadence_min(msgs) == 5.0


def test_reconstruct_interpolates_short_gap():
    # 5-min cadence with one 15-min gap: 2 points are inserted to bridge it.
    msgs = [AisMessage(timestamp=T0 + timedelta(minutes=m), longitude=72.40 + m * 0.01,
                       latitude=15.0, speed_knots=10, course_deg=60, heading_deg=60)
            for m in [0, 5, 10, 15, 30]]
    recon, interp, gaps = reconstruct_track(msgs, max_gap_min=DEFAULT_MAX_GAP_MIN)
    assert interp >= 2
    assert gaps == 0
    interpers = [m for m in recon if m.interpolated]
    assert interpers
    assert all(72.55 <= m.longitude <= 72.70 for m in interpers)
    real = [m for m in recon if not m.interpolated]
    assert [m.timestamp.minute for m in real] == [0, 5, 10, 15, 30]


def test_reconstruct_flags_long_gap():
    msgs = [AisMessage(timestamp=T0 + timedelta(minutes=m), longitude=72.40 + m * 0.01,
                       latitude=15.0, speed_knots=10, course_deg=60, heading_deg=60)
            for m in [0, 10, 60]]
    recon, interp, gaps = reconstruct_track(msgs, max_gap_min=DEFAULT_MAX_GAP_MIN)
    assert gaps == 1
    assert not any(m.interpolated for m in recon)


def test_closest_approach():
    msgs = [_msg(0, lon=72.2), _msg(1, lon=72.41), _msg(2, lon=72.6)]
    d, tca, m = closest_approach(msgs, 72.4, 15.0)
    assert d is not None and d < 3.0 and tca == msgs[1].timestamp
    assert m is not None and m.longitude == msgs[1].longitude


def test_detect_anomalies_speed_drop_and_gap():
    speed_msgs = [
        AisMessage(timestamp=T0 + timedelta(minutes=i * 5), longitude=72.40, latitude=15.0,
                   speed_knots=2.0 if 3 <= i <= 8 else 10.0, course_deg=60, heading_deg=60)
        for i in range(12)
    ]
    signals = detect_anomalies(speed_msgs, 72.4, 15.0, proximity_km=15.0)
    kinds = {s.kind for s in signals}
    assert "speed_drop" in kinds


def test_build_candidate_sets_quality_evidence():
    msgs = [_msg(i) for i in range(20)]
    track = _track(msgs)
    # Dart at distance: shift 0.2 deg lon ~ 21 km
    shifted = [AisMessage(timestamp=m.timestamp, longitude=m.longitude + 0.2, latitude=m.latitude,
                          speed_knots=m.speed_knots, course_deg=m.course_deg, heading_deg=m.heading_deg)
               for m in msgs]
    cand = build_candidate(
        _track(shifted),
        72.4, 15.0,
        T0, T0 + timedelta(hours=2),
        radius_km=50,
    )
    assert cand is not None
    assert cand.reliability in ("HIGH", "MEDIUM", "LOW")
    assert cand.messages_in_window == 20
    assert 0.0 <= cand.interpolation_fraction <= 1.0
    assert cand.min_distance_km is not None
    assert cand.closest_position is not None
    assert abs(cand.closest_position["lon"] - 72.4) > 0
    assert abs(cand.closest_position["lon"] - 72.4) < 0.4


def test_build_candidate_drops_outside_radius():
    far = [AisMessage(timestamp=m.timestamp, longitude=m.longitude + 2.0, latitude=m.latitude,
                      speed_knots=m.speed_knots, course_deg=m.course_deg, heading_deg=m.heading_deg)
           for m in (_msg(i) for i in range(20))]
    cand = build_candidate(_track(far), 72.4, 15.0, T0, T0 + timedelta(hours=2), radius_km=50)
    assert cand is None


def test_filter_candidates_keeps_dropped_audit():
    inside = [_msg(i) for i in range(10)]
    outside = [AisMessage(timestamp=m.timestamp, longitude=m.longitude + 2.0, latitude=m.latitude,
                          speed_knots=m.speed_knots, course_deg=m.course_deg, heading_deg=m.heading_deg)
               for m in inside]
    outcome = filter_candidates(
        [_track(inside, mmsi="keep"), _track(outside, mmsi="drop")],
        72.4, 15.0, T0, T0 + timedelta(hours=1), radius_km=50,
    )
    assert [c.mmsi for c in outcome.candidates] == ["keep"]
    assert outcome.dropped and outcome.dropped[0]["mmsi"] == "drop"
    assert outcome.dropped[0]["reasons"]


def test_classify_reliability_grading():
    high, _notes = classify_reliability(80, 5.0, 0.0, 0)
    assert high == "HIGH"
    low, _n = classify_reliability(3, 40.0, 0.6, 2)
    assert low == "LOW"