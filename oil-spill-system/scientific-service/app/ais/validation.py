"""Controlled recovery scenarios for the STEP 10 vessel-attribution stage.

Ground-truth isolation (SYSTEM_SPEC §14): the planting and expected outcome for
each scenario live ONLY in this module, which is exercised by the validation
endpoint/tests and never by the public attribution pipeline. The public API
path (:mod:`app.ais.providers`, :mod:`app.ais.filters`, :mod:`app.ais.scoring`)
is exactly the code under test.

Scenario set (frozen STEP plan):
  1. easy          — tanker dead-beat through the source at release time.
  2. mid-maneuver  — cargo with a heading maneuver near the source.
  3. hard-trawler  — loitering + AIS reporting gap at the source.
  4. distractors   — distractor-rich including a "false friend" close pass.
  5. no-vessel     — no plausible vessel; attribution must be inconclusive.
  6. clean-control — busy traffic but none near the source in time/space.

The backtracking evidence is synthesized as a disc of fan endpoints around the
true source (uncertainty_km radius). This isolates the attribution stage from
backtracking; Step 09 already validated source recovery end-to-end.
"""

from __future__ import annotations

import json
import math
import os
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import CONTROLLED_AIS_REFERENCE_TIME
from .contract import AisTrack, AisSourceState
from .filters import filter_candidates
from .generator import (
    VesselState,
    PlantedAnomaly,
    build_track,
    generate_fleet,
    lane_geometry,
    haversine_km,
)
from .scoring import INCONCLUSIVE_SCORE, ScoreContext, rank_vessels

# ---------------------------------------------------------------------------
# Scenario geometry (Arabian Sea demonstration domain).
# ---------------------------------------------------------------------------

ORIGIN_LON = 72.4
ORIGIN_LAT = 15.0

#: true release time of the planted leak (ground truth, internal only)
RELEASE_TIME = datetime(2026, 8, 4, 18, 0, 0, tzinfo=timezone.utc)

#: analysis window — vessels anywhere inside radius during these 72 hours
WINDOW_START = RELEASE_TIME - timedelta(hours=48)
WINDOW_END = RELEASE_TIME + timedelta(hours=24)

SEARCH_RADIUS_KM = 50.0
STANDARD_CADENCE_MIN = 5.0

# Goetic forcing used for the analytic backtracking fan + scoring.
FORCING = {"uCurrent": 0.35, "vCurrent": 0.0, "uWind": -1.5, "vWind": 0.5}


@dataclass
class Scenario:
    key: str
    label: str
    difficulty: str
    planted_mmsi: str | None
    vessels: list[VesselState]
    anomalies: list[PlantedAnomaly] = field(default_factory=list)
    expected_top1: str | None = None
    expectation: str = ""


#: bespoke N-S crossing lane, offset ~5.4 km EAST of the origin (for the
#: "false friend" perpendicular pass): it must come close but NOT pass the
#: source point itself, or the trajectory factor could not separate it.
CROSS_LANE = "cross-south-north"
CROSS_LANE_20 = "cross-south-north-20"
LANES_EXTRA: dict[str, list[tuple[float, float]]] = {
    CROSS_LANE: [
        (72.4, 13.0),
        (72.45, 14.2),
        (72.45, 15.0),
        (72.45, 16.2),
        (72.4, 17.5),
    ],
    # near-miss decoy lane ~22 km east of the origin, heading N-S.
    CROSS_LANE_20: [
        (72.61, 13.0),
        (72.61, 14.2),
        (72.61, 15.0),
        (72.61, 16.2),
        (72.61, 17.5),
    ],
}


def _register_lanes() -> None:
    from . import generator

    for key, wps in LANES_EXTRA.items():
        if key not in generator.LANES:
            generator.LANES[key] = wps
            generator._LANE_CACHE.clear()


_register_lanes()


def lane_param_for_point(lon: float, lat: float, lane_key: str) -> float:
    """Distance (km) along the lane at the point nearest (lon, lat).

    Orthogonal projection of (lon, lat) onto each lane segment in a local
    equirectangular plane — robust and O(n) per call.
    """
    from . import generator

    geo = lane_geometry(lane_key)
    wps = geo.waypoints
    lat0 = sum(p[1] for p in wps) / len(wps)
    kx = 111.0 * math.cos(math.radians(lat0))
    ky = 111.0
    px, py = lon * kx, lat * ky

    cum = [0.0]
    for (lon1, lat1), (lon2, lat2) in zip(wps, wps[1:]):
        cum.append(cum[-1] + haversine_km(lon1, lat1, lon2, lat2))

    best_dist2 = float("inf")
    best_along = 0.0
    for i in range(len(wps) - 1):
        ax, ay = wps[i][0] * kx, wps[i][1] * ky
        bx, by = wps[i + 1][0] * kx, wps[i + 1][1] * ky
        abx, aby = bx - ax, by - ay
        denom = abx * abx + aby * aby
        t = 0.0 if denom == 0 else min(1.0, max(0.0, ((px - ax) * abx + (py - ay) * aby) / denom))
        qx, qy = ax + t * abx, ay + t * aby
        d2 = (px - qx) ** 2 + (py - qy) ** 2
        if d2 < best_dist2:
            best_dist2 = d2
            best_along = cum[i] + t * (cum[i + 1] - cum[i])
    return best_along


def make_vessel(
    *,
    mmsi: str,
    name: str,
    vessel_type: str,
    lane_key: str,
    speed_kn: float,
    direction: int = 1,
    cadence_min: float = STANDARD_CADENCE_MIN,
    rest_distance_km: float | None = None,
) -> VesselState:
    return VesselState(
        mmsi=mmsi,
        name=name,
        vessel_type=vessel_type,
        length_m=160.0 if vessel_type == "TANKER" else 120.0 if vessel_type == "CARGO" else 30.0,
        lane_key=lane_key,
        rest_distance_km=rest_distance_km or 0.0,
        speed_kn=speed_kn,
        direction=direction,
        cadence_min=cadence_min,
    )


def at_point(v: VesselState, lon: float, lat: float, at_time: datetime) -> VesselState:
    """Adjust rest distance so the vessel is at (lon, lat) at at_time."""
    d_point = lane_param_for_point(lon, lat, v.lane_key)
    delta_h = (at_time - CONTROLLED_AIS_REFERENCE_TIME).total_seconds() / 3600.0
    v.rest_distance_km = d_point - v.direction * v.speed_kn * delta_h
    return v


def build_scenario_tracks(scenario: Scenario) -> list[AisTrack]:
    seed = int(scenario.label.encode("utf-8").hex(), 16) % 100000
    tracks = [
        build_track(v, CONTROLLED_AIS_REFERENCE_TIME, WINDOW_START, WINDOW_END, seed=seed, anomalies=scenario.anomalies)
        for v in scenario.vessels
    ]
    for t in tracks:
        t.source_state = AisSourceState.CONTROLLED
        t.provider = "CONTROLLED"
        t.dataset = "controlled-ais-v1"
    return tracks


def _synthetic_backtracking_fan(
    uncertainty_km: float = 8.0,
    n_members: int = 30,
    n_points: int = 4,
    seed: int = 26143,
) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    trajectories: list[dict[str, Any]] = []
    for m in range(n_members):
        pts = []
        for _p in range(n_points):
            r = uncertainty_km * math.sqrt(rng.random())
            theta = rng.uniform(0, 2 * math.pi)
            lon = ORIGIN_LON + r * math.cos(theta) / (111.0 * math.cos(math.radians(ORIGIN_LAT)))
            lat = ORIGIN_LAT + r * math.sin(theta) / 111.0
            pts.append({"lon": round(lon, 6), "lat": round(lat, 6)})
        trajectories.append({"member": m, "particle": 0, "endpoints": pts})
    return trajectories


# ---------------------------------------------------------------------------
# Scenario fleet definitions.
# ---------------------------------------------------------------------------

def _scenario_easy() -> Scenario:
    planted = at_point(
        make_vessel(mmsi="419660001", name="MT ANDHRA-01", vessel_type="TANKER", lane_key="gulf-malacca", speed_kn=10.0),
        ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME,
    )
    distractors = [
        at_point(make_vessel(mmsi="419660010", name="MV BELA-10", vessel_type="CARGO", lane_key="gulf-malacca", speed_kn=12.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME - timedelta(hours=6)),
        at_point(make_vessel(mmsi="419660011", name="MV CINNA-11", vessel_type="CARGO", lane_key="gulf-malacca", speed_kn=13.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME + timedelta(hours=6)),
        make_vessel(mmsi="419660012", name="FV DORA-12", vessel_type="FISHING", lane_key="west-coast-india", speed_kn=4.0, rest_distance_km=300),
        make_vessel(mmsi="419660013", name="MV EKTA-13", vessel_type="OTHER", lane_key="suez-cape", speed_kn=9.0, rest_distance_km=700),
        at_point(make_vessel(mmsi="419660014", name="MT FARI-14", vessel_type="TANKER", lane_key="mozambique-mumbai", speed_kn=9.0), 72.0, 15.6, RELEASE_TIME - timedelta(hours=20)),
    ]
    return Scenario(
        key="easy-tanker",
        label="easy tanker through origin",
        difficulty="easy",
        planted_mmsi="419660001",
        vessels=[planted, *distractors],
        expected_top1="419660001",
        expectation="planted tanker passes the source exactly at release time; clean pass-through",
    )


def _scenario_mid() -> Scenario:
    planted = at_point(
        make_vessel(mmsi="419660002", name="MV GULA-02", vessel_type="CARGO", lane_key="gulf-malacca", speed_kn=12.0),
        ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME,
    )
    maneuver = PlantedAnomaly(
        mmsi="419660002", kind="heading_deviation", at_time=RELEASE_TIME,
        zone_lon=ORIGIN_LON, zone_lat=ORIGIN_LAT, duration_min=60, severity=0.8,
    )
    distractors = [
        at_point(make_vessel(mmsi="419660020", name="MT HIRA-20", vessel_type="TANKER", lane_key="gulf-malacca", speed_kn=10.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME - timedelta(hours=8)),
        at_point(make_vessel(mmsi="419660021", name="MV INDI-21", vessel_type="CARGO", lane_key="gulf-malacca", speed_kn=11.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME + timedelta(hours=10)),
        at_point(make_vessel(mmsi="419660022", name="FV JAVA-22", vessel_type="FISHING", lane_key="west-coast-india", speed_kn=5.0), 72.3, 14.9, RELEASE_TIME - timedelta(hours=3)),
        make_vessel(mmsi="419660023", name="MV KARU-23", vessel_type="OTHER", lane_key="india-far-east", speed_kn=10.0, rest_distance_km=500),
    ]
    return Scenario(
        key="mid-cargo-maneuver",
        label="mid cargo with maneuver",
        difficulty="medium",
        planted_mmsi="419660002",
        vessels=[planted, *distractors],
        anomalies=[maneuver],
        expected_top1="419660002",
        expectation="cargo executes a course swing near the source at release time",
    )


def _scenario_hard() -> Scenario:
    planted = at_point(
        make_vessel(mmsi="419660003", name="FV LATA-03", vessel_type="FISHING", lane_key="west-coast-india", speed_kn=4.0),
        ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME,
    )
    loiter = PlantedAnomaly(
        mmsi="419660003", kind="loiter", at_time=RELEASE_TIME - timedelta(minutes=45),
        zone_lon=ORIGIN_LON, zone_lat=ORIGIN_LAT, duration_min=90, severity=0.9,
    )
    gap = PlantedAnomaly(
        mmsi="419660003", kind="reporting_gap", at_time=RELEASE_TIME + timedelta(minutes=10),
        zone_lon=ORIGIN_LON, zone_lat=ORIGIN_LAT, duration_min=40, severity=1.0,
    )
    distractors = [
        # near-miss loiterer ~22 km east at the same time — spatial decoy that
        # must stay below the planted loitering vessel.
        at_point(
            make_vessel(mmsi="419660030", name="FV MIRA-30", vessel_type="FISHING", lane_key=CROSS_LANE_20, speed_kn=4.0, direction=-1),
            72.61, 15.0, RELEASE_TIME,
        ),
        at_point(make_vessel(mmsi="419660031", name="MV NILA-31", vessel_type="CARGO", lane_key="gulf-malacca", speed_kn=13.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME + timedelta(hours=9)),
        make_vessel(mmsi="419660032", name="MT OPAL-32", vessel_type="TANKER", lane_key="gulf-malacca", speed_kn=10.0, rest_distance_km=400),
        make_vessel(mmsi="419660033", name="MV PADI-33", vessel_type="OTHER", lane_key="suez-cape", speed_kn=9.0, rest_distance_km=900),
    ]
    return Scenario(
        key="hard-trawler-loiter-gap",
        label="hard: trawler loiter + AIS gap",
        difficulty="hard",
        planted_mmsi="419660003",
        vessels=[planted, *distractors],
        anomalies=[loiter, gap],
        expected_top1="419660003",
        expectation="fishing vessel loiters at the source then goes silent (transponder off) — a hard case with AIS gap",
    )


def _scenario_distractors() -> Scenario:
    planted = at_point(
        make_vessel(mmsi="419660004", name="MT QAMAR-04", vessel_type="TANKER", lane_key="gulf-malacca", speed_kn=11.0),
        ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME,
    )
# False friend: passes within ~5 km east of the source 15 min before
    # release, on a *perpendicular* heading. Spatial + trajectory keep it below
    # the planted vessel; temporal closeness keeps it inside the candidate set.
    false_friend = at_point(
        make_vessel(mmsi="419660041", name="MV RANA-41", vessel_type="CARGO", lane_key=CROSS_LANE, speed_kn=12.0),
        72.45, 15.0, RELEASE_TIME - timedelta(minutes=15),
    )
    distractors = [
        false_friend,
        at_point(make_vessel(mmsi="419660042", name="MT SOLA-42", vessel_type="TANKER", lane_key="gulf-malacca", speed_kn=9.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME - timedelta(hours=12)),
        at_point(make_vessel(mmsi="419660043", name="MV TARA-43", vessel_type="CARGO", lane_key="india-far-east", speed_kn=12.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME + timedelta(hours=5)),
        at_point(make_vessel(mmsi="419660044", name="FV UMA-44", vessel_type="FISHING", lane_key="west-coast-india", speed_kn=4.5), 72.2, 15.3, RELEASE_TIME + timedelta(hours=2)),
        make_vessel(mmsi="419660045", name="MV VELA-45", vessel_type="OTHER", lane_key="suez-cape", speed_kn=9.0, rest_distance_km=600),
    ]
    return Scenario(
        key="distractor-rich-false-friend",
        label="distractor-rich incl. false friend",
        difficulty="hard",
        planted_mmsi="419660004",
        vessels=[planted, *distractors],
        expected_top1="419660004",
        expectation=(
            "a 'false friend' cargo passes within ~2 km of the source 15 minutes "
            "before release on a perpendicular heading; must NOT outrank the planted vessel"
        ),
    )


def _scenario_no_vessel() -> Scenario:
    dist = [
        at_point(make_vessel(mmsi="419660050", name="MT AMAR-50", vessel_type="TANKER", lane_key="gulf-malacca", speed_kn=10.0), ORIGIN_LON - 0.45, ORIGIN_LAT - 0.1, RELEASE_TIME + timedelta(hours=1)),
        at_point(make_vessel(mmsi="419660051", name="MV BHAR-51", vessel_type="CARGO", lane_key="mozambique-mumbai", speed_kn=11.0), ORIGIN_LON + 0.4, ORIGIN_LAT + 0.15, RELEASE_TIME - timedelta(hours=2)),
        at_point(make_vessel(mmsi="419660052", name="MV CHAN-52", vessel_type="CARGO", lane_key="india-far-east", speed_kn=13.0), ORIGIN_LON - 0.5, ORIGIN_LAT + 0.2, RELEASE_TIME + timedelta(hours=4)),
        make_vessel(mmsi="419660053", name="FV DEVI-53", vessel_type="FISHING", lane_key="west-coast-india", speed_kn=4.0, rest_distance_km=200),
    ]
    return Scenario(
        key="no-vessel-inconclusive",
        label="no vessel -> inconclusive",
        difficulty="medium",
        planted_mmsi=None,
        vessels=dist,
        expected_top1=None,
        expectation="no vessel plausibly at the source at release time — attribution must be inconclusive, no false top-1",
    )


def _scenario_clean() -> Scenario:
    traffic = [
        at_point(make_vessel(mmsi="419660060", name="MV ADIT-60", vessel_type="CARGO", lane_key="gulf-malacca", speed_kn=12.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME - timedelta(hours=22)),
        at_point(make_vessel(mmsi="419660061", name="MV BHUM-61", vessel_type="CARGO", lane_key="gulf-malacca", speed_kn=12.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME + timedelta(hours=17)),
        at_point(make_vessel(mmsi="419660062", name="MT CHIT-62", vessel_type="TANKER", lane_key="gulf-malacca", speed_kn=9.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME + timedelta(hours=26)),
        at_point(make_vessel(mmsi="419660063", name="MV DHAV-63", vessel_type="PASSENGER", lane_key="west-coast-india", speed_kn=14.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME - timedelta(hours=14)),
        at_point(make_vessel(mmsi="419660064", name="FV EKLA-64", vessel_type="FISHING", lane_key="west-coast-india", speed_kn=4.0), ORIGIN_LON, ORIGIN_LAT, RELEASE_TIME - timedelta(hours=30)),
        make_vessel(mmsi="419660065", name="MV GANA-65", vessel_type="OTHER", lane_key="suez-cape", speed_kn=9.0, rest_distance_km=400),
    ]
    return Scenario(
        key="clean-traffic-control",
        label="clean traffic control",
        difficulty="control",
        planted_mmsi=None,
        vessels=traffic,
        expected_top1=None,
        expectation="normal traffic but none near the source at release time — control for false positives",
    )


SCENARIOS: dict[str, Scenario] = {
    s.key: s
    for s in [
        _scenario_easy(),
        _scenario_mid(),
        _scenario_hard(),
        _scenario_distractors(),
        _scenario_no_vessel(),
        _scenario_clean(),
    ]
}


def run_scenario(scenario: Scenario) -> dict[str, Any]:
    tracks = build_scenario_tracks(scenario)
    outcome = filter_candidates(
        tracks,
        ORIGIN_LON,
        ORIGIN_LAT,
        WINDOW_START,
        WINDOW_END,
        SEARCH_RADIUS_KM,
    )
    ctx = ScoreContext(
        origin_lon=ORIGIN_LON,
        origin_lat=ORIGIN_LAT,
        release_time=RELEASE_TIME,
        search_radius_km=SEARCH_RADIUS_KM,
        backtracking_fan=_synthetic_backtracking_fan(seed=26143),
        environment=FORCING,
    )
    ranked = rank_vessels(outcome.candidates, ctx)

    ranked_vessels = ranked["ranked_vessels"]
    planted = scenario.planted_mmsi
    rank = next((v["rank"] for v in ranked_vessels if v["mmsi"] == planted), None) if planted else None

    top1_hit = bool(planted and ranked_vessels and ranked_vessels[0]["mmsi"] == planted)
    top3_hit = bool(planted and rank is not None and rank <= 3)
    mrr = (1.0 / rank) if rank else 0.0
    input_vessels = len(tracks)
    reduction_ratio = 1.0 - (len(ranked_vessels) / input_vessels) if input_vessels else 0.0
    coverage = (len(ranked_vessels) / len(outcome.candidates)) if outcome.candidates else 0.0

    ranking = ranked["ranking"]
    return {
        "scenario": scenario.key,
        "label": scenario.label,
        "difficulty": scenario.difficulty,
        "planted_mmsi": planted,
        "expected_top1": scenario.expected_top1,
        "top1_hit": bool(top1_hit),
        "top3_hit": bool(top3_hit),
        "planted_rank": rank,
        "mrr": round(mrr, 4),
        "top_score": ranking["top_score"],
        "second_score": ranking["second_score"],
        "margin": ranking["margin"],
        "decisive": ranking["decisive"],
        "conclusion": ranked["conclusion"],
        "reduction_ratio": round(reduction_ratio, 4),
        "coverage": round(coverage, 4),
        "input_vessels": input_vessels,
        "candidates": len(outcome.candidates),
        "kept_in_recon": len(ranked_vessels),
        "top1_mmsi": ranked_vessels[0]["mmsi"] if ranked_vessels else None,
        "top_n_mmsi": [v["mmsi"] for v in ranked_vessels[:3]],
        "meets_target_top1": top1_hit or scenario.expected_top1 is None,
        "meets_target_top3": top3_hit or scenario.expected_top1 is None,
        "meets_target_inconclusive": (scenario.planted_mmsi is None) == (ranked["conclusion"] == "inconclusive"),
        "expectation_satisfied": _expectation_ok(scenario, ranked, top1_hit, top3_hit),
        "source_state_seen": sorted({v.get("source_state", "CONTROLLED") for v in ranked_vessels}),
        "warnings": ranked["warnings"],
    }


def _expectation_ok(scenario: Scenario, ranked: dict, top1_hit: bool, top3_hit: bool) -> bool:
    if scenario.expected_top1 is not None:
        return bool(top1_hit)
    return ranked["conclusion"] == "inconclusive"


def run_all_scenarios(
    only: str | None = None,
    seed: int | None = None,
    write_artifact: bool = False,
) -> dict[str, Any]:
    """Run the (sub)set of controlled scenarios and aggregate measured metrics."""
    keys = [only] if only else list(SCENARIOS)
    missing = [k for k in keys if k not in SCENARIOS]
    if missing:
        raise ValueError(f"unknown scenario(s): {missing}; valid: {sorted(SCENARIOS)}")

    results = []
    for key in keys:
        scenario = SCENARIOS[key]
        results.append(run_scenario(scenario))

    planted_included = [r for r in results if r["planted_mmsi"]]
    metrics = {
        "scenario_count": len(results),
        "top1_rate": round(sum(r["top1_hit"] for r in planted_included) / len(planted_included), 4) if planted_included else None,
        "top3_rate": round(sum(r["top3_hit"] for r in planted_included) / len(planted_included), 4) if planted_included else None,
        "mean_mrr": round(sum(r["mrr"] for r in planted_included) / len(planted_included), 4) if planted_included else None,
        "mean_margin": round(sum(r["margin"] for r in results) / len(results), 4),
        "mean_reduction_ratio": round(sum(r["reduction_ratio"] for r in results) / len(results), 4),
        "mean_coverage": round(sum(r["coverage"] for r in results) / len(results), 4),
        "expectation_satisfied": all(r["expectation_satisfied"] for r in results),
        "target_top1_gt_0_7": (sum(r["top1_hit"] for r in planted_included) / len(planted_included) > 0.7) if planted_included else None,
        "target_top3_gt_0_9": (sum(r["top3_hit"] for r in planted_included) / len(planted_included) > 0.9) if planted_included else None,
    }

    payload = {
        "metadata": {
            "experiment": "STEP10-ais-attribution-controlled-recovery",
            "model_version": "ais-scoring-v1",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "seed": seed,
            "weights": {"spatial": 0.25, "temporal": 0.20, "trajectory": 0.25, "anomaly": 0.15, "environmental": 0.15},
            "targets": {"top1_gt": 0.7, "top3_gt": 0.9},
            "note": (
                "Controlled attributable scenarios. Ground truth is enclosed in the "
                "validation harness; the public AIS/attribution API path never sees it. "
                "AIS traffic is deterministic simulated (CONTROLLED), never presented as real."
            ),
        },
        "metrics": metrics,
        "scenarios": results,
    }

    if write_artifact:
        here = os.path.dirname(os.path.abspath(__file__))
        root = os.path.abspath(os.path.join(here, "..", "..", "..", ".."))
        target = os.path.join(root, "research", "25-ais-attribution", "step10_validation_results.json")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, default=str)
        payload["artifact_path"] = target
    return payload