"""Deterministic, seeded simulation of historical AIS traffic (Layer A).

Design (mirrors SYSTEM_SPEC §10.1 decision, recorded in STEP_10_REPORT):

* The provider fleet rides a set of coarse, stable shipping lanes across the
  Arabian Sea demonstration domain. Each vessel moves along its lane at a
  speed sampled from its type's realistic range, emitting AIS position
  reports at a fixed cadence. Vessel identity, lane, rest-distance, speed and
  direction are all sampled from a seeded PRNG, so the same seed reproduces
  the exact same fleet and tracks ("controlled"). Motion is a pure function of
  elapsed time since the reference instant and is folded into a round trip
  over the lane length, so the world stays inhabited (and reproducible) for
  ANY query window — not only windows within ~a month of the reference date.

* The fleet is deliberately sparse (~30 vessels over 5 lanes) so a
  fixed-radius query returns a manageable handful of candidates — enough to
  exercise reconstruction, filtering, anomaly detection and ranking honestly
  without pretending to reproduce the true density of live AIS traffic.

* ``PlantedAnomaly`` specs exist to let the controlled validation scenarios
  (and controlled demo investigations) provoke the rule-based anomaly layer:
  speed drops, loitering, transponder gaps, and heading deviations near a
  target zone. They are always exercised through the SAME generator code the
  public API uses; ground truth never enters the HTTP path (see validation.py).

This module never calls a real AIS provider. The GFW / Marine Cadastre /
aisstream.io seams live in providers.py and are honest about being unavailable.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Literal

from .contract import AisMessage, AisSourceState, AisTrack, AisValidationError

# ---------------------------------------------------------------------------
# Shipping lanes (Arabian Sea demonstration domain, centred near 14.5N 72.4E).
# Waypoints are [lon, lat]. These are coarse route corridors, NOT surveyed
# traffic density — the generator only needs them to produce plausible,
# reproducible vessel motion for the AIS pipeline experiments.
# ---------------------------------------------------------------------------

#: lane key -> [waypoint, ...]
LANES: dict[str, list[tuple[float, float]]] = {
    "gulf-malacca": [
        (56.5, 24.8),
        (59.5, 23.0),
        (63.0, 20.5),
        (66.5, 17.5),
        (69.5, 16.2),
        (72.4, 15.0),
        (76.0, 12.5),
        (80.0, 6.5),
        (82.0, 5.0),
    ],
    "suez-cape": [
        (43.5, 12.5),
        (45.0, 11.0),
        (50.0, 10.0),
        (55.0, 9.0),
        (60.0, 7.0),
        (65.0, 5.5),
        (70.0, 4.0),
        (75.0, 2.5),
        (80.0, 0.5),
    ],
    "india-far-east": [
        (70.0, 18.0),
        (73.0, 16.0),
        (76.0, 13.5),
        (79.5, 10.0),
        (83.0, 8.0),
        (88.0, 6.5),
    ],
    "west-coast-india": [
        (70.5, 18.5),
        (72.0, 17.0),
        (72.4, 15.0),
        (72.4, 14.5),
        (72.6, 12.0),
        (73.0, 9.5),
        (74.0, 7.5),
    ],
    "mozambique-mumbai": [
        (40.5, -14.5),
        (43.0, -10.5),
        (47.0, -5.5),
        (52.0, 0.0),
        (58.0, 5.0),
        (63.0, 9.0),
        (68.0, 12.5),
        (72.4, 15.0),
        (74.5, 18.0),
    ],
}

#: vessel type -> (speed_kn_min, speed_kn_max, length_m_min, length_m_max)
VESSEL_PROFILES: dict[str, tuple[float, float, float, float]] = {
    "TANKER": (8.0, 14.0, 150.0, 330.0),
    "CARGO": (10.0, 16.0, 90.0, 280.0),
    "FISHING": (3.0, 7.0, 15.0, 45.0),
    "PASSENGER": (12.0, 18.0, 80.0, 200.0),
    "OTHER": (8.0, 12.0, 40.0, 120.0),
}

#: messages per vessel every N minutes (historical extract resolution)
DEFAULT_CADENCE_MIN = 5.0

#: how a vessel's MMSI is minted (deterministic, unique within a seed universe)
_MMSI_BASE = 419_600_000


@dataclass
class LaneGeometry:
    """Precomputed piecewise-lane: waypoint cumulative distance (km) + points."""

    key: str
    waypoints: list[tuple[float, float]]
    cum_km: list[float]
    total_km: float

    def __post_init__(self) -> None:
        if len(self.waypoints) < 2:
            raise AisValidationError(f"lane '{self.key}' needs >= 2 waypoints")


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance in km."""
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def build_lane_geometry(key: str, waypoints: list[tuple[float, float]]) -> LaneGeometry:
    cum = [0.0]
    for (lon1, lat1), (lon2, lat2) in zip(waypoints, waypoints[1:]):
        cum.append(cum[-1] + haversine_km(lon1, lat1, lon2, lat2))
    return LaneGeometry(key=key, waypoints=waypoints, cum_km=cum, total_km=cum[-1])


_LANE_CACHE: dict[str, LaneGeometry] = {}


def lane_geometry(key: str) -> LaneGeometry:
    geo = _LANE_CACHE.get(key)
    if geo is None:
        geo = build_lane_geometry(key, LANES[key])
        _LANE_CACHE[key] = geo
    return geo


def lane_position(geo: LaneGeometry, distance_km: float) -> tuple[float, float]:
    """(lon, lat) at distance along the lane (linearly blended between waypoints)."""
    d = max(0.0, min(geo.total_km, distance_km))
    lo_idx = 0
    for i, c in enumerate(geo.cum_km):
        if c >= d:
            lo_idx = max(0, i - 1)
            break
    else:
        lo_idx = len(geo.cum_km) - 2
    seg = geo.cum_km[lo_idx + 1] - geo.cum_km[lo_idx]
    frac = 0.0 if seg <= 0 else (d - geo.cum_km[lo_idx]) / seg
    lon1, lat1 = geo.waypoints[lo_idx]
    lon2, lat2 = geo.waypoints[lo_idx + 1]
    return (lon1 + frac * (lon2 - lon1), lat1 + frac * (lat2 - lat1))


def lane_bearing_at(geo: LaneGeometry, distance_km: float) -> float:
    """Course along the lane at distance (degrees clockwise from north)."""
    d = max(0.0, min(geo.total_km, distance_km))
    s = 0.5  # km small delta along the lane
    (lon1, lat1) = lane_position(geo, max(0.0, d - s))
    (lon2, lat2) = lane_position(geo, min(geo.total_km, d + s))
    return course_between(lon1, lat1, lon2, lat2)


def course_between(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Initial bearing between two points, 0..360."""
    y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(
        math.radians(lat1)
    ) * math.cos(math.radians(lat2)) * math.cos(math.radians(lon2 - lon1))
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


@dataclass
class VesselState:
    """Internal motion parameters for a generated vessel (not wire format)."""

    mmsi: str
    name: str
    vessel_type: str
    length_m: float
    lane_key: str
    rest_distance_km: float
    speed_kn: float
    direction: int  # +1 forward along lane, -1 reverse
    cadence_min: float = DEFAULT_CADENCE_MIN


@dataclass
class PlantedAnomaly:
    """Spec for provoking a rule-based anomaly near a target zone.

    Used ONLY by the controlled scenario layer (validation.py / fixtures). It is
    never accepted by the public HTTP API, keeping ground truth out of the
    served pipeline.
    """

    mmsi: str
    kind: Literal["speed_drop", "loiter", "reporting_gap", "heading_deviation"]
    at_time: datetime
    zone_lon: float
    zone_lat: float
    duration_min: float = 60.0
    severity: float = 0.5  # 0..1 magnitude of the planted behaviour


def _name_for(rng: random.Random, vessel_type: str, idx: int) -> str:
    prefix = {"TANKER": "MT", "CARGO": "MV", "FISHING": "FV", "PASSENGER": "MS", "OTHER": "MV"}[vessel_type]
    syllables = [
        "ARA", "BELA", "CINNA", "DORA", "EKTA", "FARI", "GULA", "HIRA",
        "INDI", "JAVA", "KARU", "LATA", "MIRA", "NILA", "OPAL", "PADI",
    ]
    a = syllables[rng.randrange(len(syllables))]
    b = syllables[rng.randrange(len(syllables))]
    return f"{prefix} {a}{b}-{idx:02d}"


@dataclass
class FleetSpec:
    """Fleet composition per lane key -> list of vessel types to spawn."""

    per_lane: dict[str, list[str]] = field(default_factory=dict)


DEFAULT_FLEET: FleetSpec = FleetSpec(
    per_lane={
        "gulf-malacca": ["TANKER", "TANKER", "CARGO", "CARGO", "OTHER", "TANKER"],
        "suez-cape": ["CARGO", "CARGO", "OTHER", "CARGO", "TANKER", "CARGO"],
        "india-far-east": ["CARGO", "CARGO", "PASSENGER", "CARGO", "OTHER", "CARGO"],
        "west-coast-india": ["TANKER", "FISHING", "CARGO", "FISHING", "FISHING", "PASSENGER"],
        "mozambique-mumbai": ["TANKER", "CARGO", "CARGO", "OTHER", "TANKER", "CARGO"],
    }
)


def generate_fleet(
    fleet: FleetSpec | None = None,
    *,
    seed: int | None = None,
    reference_time: datetime | None = None,
) -> list[VesselState]:
    """Deterministically build the vessel fleet for a seed.

    ``reference_time`` fixes the fleet's "rest positions"; motion is a pure
    function of elapsed time from it, so the same seed always yields the same
    world regardless of when the query window sits.
    """
    rng = random.Random(seed)
    if fleet is None:
        fleet = DEFAULT_FLEET
    idx = 0
    vessels: list[VesselState] = []
    for lane_key, types in fleet.per_lane.items():
        geo = lane_geometry(lane_key)
        for vtype in types:
            speed_lo, speed_hi, len_lo, len_hi = VESSEL_PROFILES[vtype]
            mmsi_num = _MMSI_BASE + idx * 7
            vessel = VesselState(
                mmsi=str(mmsi_num),
                name=_name_for(rng, vtype, idx),
                vessel_type=vtype,
                length_m=round(rng.uniform(len_lo, len_hi), 1),
                lane_key=lane_key,
                rest_distance_km=rng.uniform(0.0, geo.total_km),
                speed_kn=round(rng.uniform(speed_lo, speed_hi), 2),
                direction=rng.choice([-1, 1]),
                cadence_min=DEFAULT_CADENCE_MIN,
            )
            vessels.append(vessel)
            idx += 1
    return vessels


def _distance_along_since_rest(v: VesselState, t: datetime, reference_time: datetime) -> float:
    delta_h = (t - reference_time).total_seconds() / 3600.0
    return v.rest_distance_km + v.direction * v.speed_kn * delta_h


def _folded_lane_motion(v: VesselState, t: datetime, reference_time: datetime) -> tuple[float, int]:
    """Date-stable along-lane position as a round trip over the lane.

    Raw motion ``rest + direction * speed * elapsed`` grows without bound, so for
    query windows more than roughly a month from ``reference_time`` every vessel
    would sit clamped at a lane terminus and the whole domain would empty out.
    Folding elapsed motion into a triangular (ping-pong) wave over ``[0, L]``
    (``L`` = lane length, ``L`` km out then ``L`` km back, repeating) keeps the
    controlled world inhabited for ANY query date while staying deterministic
    and teleport-free. Returns ``(distance_km, sign)`` where ``sign`` is the
    instantaneous sailing direction (-1 or +1) used for the course.
    """
    geo = lane_geometry(v.lane_key)
    L = geo.total_km
    if L <= 0.0:
        return 0.0, v.direction
    if v.speed_kn <= 0.0:
        return min(max(_distance_along_since_rest(v, t, reference_time), 0.0), L), v.direction
    period = 2.0 * L
    phase = _distance_along_since_rest(v, t, reference_time) % period
    if phase < L:
        return phase, v.direction
    return period - phase, -v.direction


def vessel_position_at(v: VesselState, t: datetime, reference_time: datetime) -> tuple[float, float]:
    geo = lane_geometry(v.lane_key)
    d, _sign = _folded_lane_motion(v, t, reference_time)
    return lane_position(geo, d)


def vessel_bearing_at(v: VesselState, t: datetime, reference_time: datetime) -> float:
    geo = lane_geometry(v.lane_key)
    d, sign = _folded_lane_motion(v, t, reference_time)
    b = lane_bearing_at(geo, d)
    return (b + 180) % 360 if sign < 0 else b


def _min_distance_to_zone(
    lon: float, lat: float, zlon: float, zlat: float, radius_km: float
) -> bool:
    return haversine_km(lon, lat, zlon, zlat) <= radius_km


def message_time_series(
    v: VesselState,
    reference_time: datetime,
    start: datetime,
    end: datetime,
    anomalies: list[PlantedAnomaly] | None = None,
    rng: random.Random | None = None,
) -> list[AisMessage]:
    """Generate the raw message series for one vessel over [start, end].

    Anomalies are applied to the SAME series the normal path would produce:
    the planted behaviour simply edits speeds/positions or drops reports on
    the seed's deterministic motion.
    """
    rng = rng or random.Random(v.mmsi)
    gap_ranges: list[tuple[datetime, datetime]] = []
    speed_drop_spans: list[tuple[datetime, datetime, float]] = []
    loiter_spans: list[tuple[datetime, datetime, tuple[float, float]]] = []
    dev_spans: list[tuple[datetime, datetime, float]] = []
    for anom in anomalies or []:
        if anom.mmsi != v.mmsi:
            continue
        a0 = anom.at_time
        a1 = a0 + timedelta(minutes=anom.duration_min)
        if anom.kind == "reporting_gap":
            gap_ranges.append((a0, a1))
        elif anom.kind == "speed_drop":
            speed_drop_spans.append((a0, a1, max(0.05, 1.0 - anom.severity)))
        elif anom.kind == "loiter":
            loiter_spans.append((a0, a1, (anom.zone_lon, anom.zone_lat)))
        elif anom.kind == "heading_deviation":
            dev_spans.append((a0, a1, math.radians(30 + 60 * anom.severity)))

    cadence = timedelta(minutes=v.cadence_min)
    t = start
    messages: list[AisMessage] = []
    while t <= end:
        in_gap = any(a0 <= t <= a1 for a0, a1 in gap_ranges)
        in_drop = next((f for (a0, a1, f) in speed_drop_spans if a0 <= t <= a1), None)
        in_loiter = next(((a0, a1, z) for (a0, a1, z) in loiter_spans if a0 <= t <= a1), None)
        in_dev = next(((a0, a1, ang) for (a0, a1, ang) in dev_spans if a0 <= t <= a1), None)

        lon, lat = vessel_position_at(v, t, reference_time)
        speed = v.speed_kn
        course = vessel_bearing_at(v, t, reference_time)

        if in_loiter is not None and _min_distance_to_zone(lon, lat, in_loiter[2][0], in_loiter[2][1], 6.0):
            # Loitering: drift slowly near the zone with a small circular wiggle.
            lo_lon, lo_lat = in_loiter[2]
            angle = (t - in_loiter[0]).total_seconds() * 2e-4
            wiggle = 0.8
            lon = lo_lon + wiggle * math.cos(angle)
            lat = lo_lat + wiggle * math.sin(angle) * 0.6
            speed = round(rng.uniform(0.3, 0.8), 2)
            course = (course + 90) % 360

        if in_drop is not None:
            speed = round(speed * in_drop, 2)

        if in_dev is not None and speed >= 6.0:
            swing = in_dev[2]
            if in_dev[1] > in_dev[0]:
                progress = (t - in_dev[0]).total_seconds() / (in_dev[1] - in_dev[0]).total_seconds()
                dev = math.sin(progress * 2 * math.pi) * swing / 2
            else:
                dev = 0.0
            course = (course + math.degrees(dev)) % 360

        heading = (course + rng.gauss(0, 1.5)) % 360
        if not in_gap:
            messages.append(
                AisMessage(
                    timestamp=t,
                    longitude=round(lon, 6),
                    latitude=round(lat, 6),
                    speed_knots=round(speed, 2),
                    course_deg=round(course, 1),
                    heading_deg=round(heading, 1),
                    interpolated=False,
                )
            )
        t += cadence
    return messages


def build_track(
    v: VesselState,
    reference_time: datetime,
    start: datetime,
    end: datetime,
    seed: int | None = None,
    anomalies: list[PlantedAnomaly] | None = None,
) -> AisTrack:
    rng = random.Random(f"{seed}:{v.mmsi}")
    msgs = message_time_series(v, reference_time, start, end, anomalies=anomalies, rng=rng)
    return AisTrack(
        mmsi=v.mmsi,
        name=v.name,
        vessel_type=v.vessel_type,
        imo=f"IMO{int(v.mmsi) % 1000000:07d}",
        length_m=v.length_m,
        messages=msgs,
        source_state=AisSourceState.CONTROLLED,
        provider="CONTROLLED",
        dataset="controlled-ais-v1",
        generator_seed=seed,
    )


def track_near_origin(
    track: AisTrack,
    origin_lon: float,
    origin_lat: float,
    radius_km: float,
    start: datetime,
    end: datetime,
) -> bool:
    """True if the vessel's series comes within radius at any window moment."""
    for m in track.messages:
        if not (start <= m.timestamp <= end):
            continue
        if haversine_km(m.longitude, m.latitude, origin_lon, origin_lat) <= radius_km:
            return True
    return False


def focus_tracks(
    tracks: list[AisTrack],
    origin_lon: float,
    origin_lat: float,
    radius_km: float,
    start: datetime,
    end: datetime,
    margin_km: float = 5.0,
    max_tracks: int | None = None,
) -> list[AisTrack]:
    """Spatial prefilter (what a real provider's bbox query would return)."""
    keep = [
        t
        for t in tracks
        if track_near_origin(t, origin_lon, origin_lat, radius_km + margin_km, start, end)
    ]
    keep.sort(key=lambda t: t.mmsi)
    if max_tracks is not None:
        keep = keep[:max_tracks]
    return keep


def utcnow() -> datetime:
    return datetime.now(timezone.utc)