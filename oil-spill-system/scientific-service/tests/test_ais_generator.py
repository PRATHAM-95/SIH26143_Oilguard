"""Generator: lane geometry, motion, message series, planted anomalies."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest

from app.ais.generator import (
    VESSEL_PROFILES,
    VesselState,
    build_track,
    generate_fleet,
    haversine_km,
    lane_geometry,
    lane_position,
    message_time_series,
    vessel_position_at,
)
from app.ais.config import CONTROLLED_AIS_REFERENCE_TIME

W = datetime(2026, 8, 4, 12, 0, 0, tzinfo=timezone.utc)


def _v(lane="gulf-malacca", speed=10.0, **kw):
    return VesselState(
        mmsi="419660000", name="MT TEST-00", vessel_type="TANKER",
        length_m=200.0, lane_key=lane, rest_distance_km=0.0,
        speed_kn=speed, direction=1, cadence_min=5.0, **kw,
    )


def test_fleet_deterministic():
    a = generate_fleet(seed=5, reference_time=CONTROLLED_AIS_REFERENCE_TIME)
    b = generate_fleet(seed=5, reference_time=CONTROLLED_AIS_REFERENCE_TIME)
    assert [(v.mmsi, v.rest_distance_km, v.speed_kn) for v in a] == \
           [(v.mmsi, v.rest_distance_km, v.speed_kn) for v in b]
    assert len(a) > 0


def test_fleet_speeds_within_profiles():
    fleet = generate_fleet(seed=5, reference_time=CONTROLLED_AIS_REFERENCE_TIME)
    for v in fleet:
        lo, hi, _len_lo, _len_hi = VESSEL_PROFILES[v.vessel_type]
        assert lo - 1e-6 <= v.speed_kn <= hi + 1e-6


def test_vessel_position_on_lane():
    v = _v(lane="gulf-malacca", speed=10.0)
    lon, lat = vessel_position_at(v, CONTROLLED_AIS_REFERENCE_TIME, CONTROLLED_AIS_REFERENCE_TIME)
    # rest distance 0 -> exactly the first waypoint
    geo = lane_geometry("gulf-malacca")
    w0 = geo.waypoints[0]
    assert abs(lon - w0[0]) < 1e-6 and abs(lat - w0[1]) < 1e-6


def test_message_series_monotonic_and_count():
    v = _v(speed=10.0)
    msgs = message_time_series(v, CONTROLLED_AIS_REFERENCE_TIME, W, W + timedelta(hours=6))
    assert len(msgs) == 6 * 60 / 5 + 1  # +1 inclusive end
    stamps = [m.timestamp for m in msgs]
    assert all(b > a for a, b in zip(stamps, stamps[1:]))


def test_positions_advance_geographically():
    v = _v(speed=10.0)
    t0 = W
    t1 = W + timedelta(hours=6)
    (lon0, lat0) = vessel_position_at(v, t0, CONTROLLED_AIS_REFERENCE_TIME)
    (lon1, lat1) = vessel_position_at(v, t1, CONTROLLED_AIS_REFERENCE_TIME)
    travelled = haversine_km(lon0, lat0, lon1, lat1)
    assert abs(travelled - 10.0 * 6.0) < 5.0


def test_world_populated_at_arbitrary_query_date():
    """The controlled world must not empty out far from the reference date.

    Regression for the STEP 10 live finding: with unbounded linear motion the
    fleet clamped at lane termini ~1 month after the reference time, so any
    real-world simulation (clock "now" = weeks after 2026-08-01) saw zero AIS
    traffic. Round-trip folding keeps a stable population on the lanes for ANY
    window.
    """
    from app.ais.generator import focus_tracks, generate_fleet

    fleet = generate_fleet(seed=26143, reference_time=CONTROLLED_AIS_REFERENCE_TIME)
    # Sim clocks start at "now"; pick a date well after the reference instant.
    t_start = datetime(2026, 9, 6, 0, 0, 0, tzinfo=timezone.utc)
    t_end = t_start + timedelta(hours=6)
    tracks = [
        build_track(v, CONTROLLED_AIS_REFERENCE_TIME, t_start, t_end, seed=26143)
        for v in fleet
    ]
    near = focus_tracks(tracks, 72.5, 14.5, 150.0, t_start, t_end)
    assert len(near) >= 1, "lanes must still carry traffic months after the reference date"


def test_reporting_gap_removes_messages():
    from app.ais.generator import PlantedAnomaly

    v = _v(speed=10.0)
    anomaly = PlantedAnomaly(
        mmsi="419660000", kind="reporting_gap",
        at_time=W + timedelta(hours=1), zone_lon=0, zone_lat=0, duration_min=60,
    )
    base = message_time_series(v, CONTROLLED_AIS_REFERENCE_TIME, W, W + timedelta(hours=6))
    with_gap = message_time_series(
        v, CONTROLLED_AIS_REFERENCE_TIME, W, W + timedelta(hours=6),
        anomalies=[anomaly],
    )
    assert len(with_gap) < len(base)
    # a ~1h window of messages removed
    assert len(base) - len(with_gap) >= 11


def test_loiter_slows_to_near_zero():
    from app.ais.generator import PlantedAnomaly

    v = _v(speed=10.0)
    # Anchor the zone at the vessel's actual position when the anomaly starts,
    # otherwise the 6 km zone test never matches a far-away lane position.
    at_time = W + timedelta(hours=1)
    for_zone = vessel_position_at(v, at_time, CONTROLLED_AIS_REFERENCE_TIME)
    anomaly = PlantedAnomaly(
        mmsi="419660000", kind="loiter",
        at_time=at_time, zone_lon=for_zone[0], zone_lat=for_zone[1], duration_min=60,
    )
    msgs = message_time_series(
        v, CONTROLLED_AIS_REFERENCE_TIME, W, W + timedelta(hours=4),
        anomalies=[anomaly],
    )
    loitering = [m for m in msgs if at_time <= m.timestamp <= at_time + timedelta(minutes=10)]
    assert loitering
    assert all(m.speed_knots <= 1.0 for m in loitering)
    # behaviour returns to normal once the vessel steams out of the zone's reach
    assert any(m.speed_knots > 1.0 for m in msgs if m.timestamp > at_time + timedelta(hours=1))


def test_heading_deviation_changes_course():
    from app.ais.generator import PlantedAnomaly

    v = _v(speed=12.0)
    anomaly = PlantedAnomaly(
        mmsi="419660000", kind="heading_deviation",
        at_time=W + timedelta(hours=1), zone_lon=72.4, zone_lat=15.0, duration_min=60, severity=0.8,
    )
    msgs = message_time_series(
        v, CONTROLLED_AIS_REFERENCE_TIME, W, W + timedelta(hours=3),
        anomalies=[anomaly],
    )
    courses = [m.course_deg for m in msgs]
    assert len(set(round(c, 0) for c in courses)) >= 3  # course visibly swings


def test_build_track_labels():
    v = _v()
    t = build_track(v, CONTROLLED_AIS_REFERENCE_TIME, W, W + timedelta(hours=1))
    assert t.mmsi == "419660000"
    assert t.source_state.value == "CONTROLLED"
    assert all(not m.interpolated for m in t.messages)