"""Scoring: frozen five-factor composite, per-factor evidence, integrity."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest

from app.ais.contract import AisCandidate, AisTrack, AisMessage, AnomalySignal, AisSourceState
from app.ais.filters import build_candidate, DEFAULT_MAX_GAP_MIN
from app.ais.scoring import (
    DECISIVE_MARGIN,
    FIVE_FACTOR_WEIGHTS,
    INCONCLUSIVE_SCORE,
    ScoreContext,
    factor_anomaly,
    factor_environmental,
    factor_spatial,
    factor_temporal,
    factor_trajectory,
    rank_vessels,
    score_candidate,
)

ORIGIN_LON, ORIGIN_LAT = 72.4, 15.0
RELEASE = datetime(2026, 8, 4, 18, 0, 0, tzinfo=timezone.utc)


def _msg(t, lon, lat, speed=10.0, course=60.0):
    return AisMessage(timestamp=t, longitude=lon, latitude=lat,
                      speed_knots=speed, course_deg=course, heading_deg=course)


def _track(mmsi, lon, lat, start=None, n=20, step_min=5, speed=10.0):
    start = start or (RELEASE - timedelta(minutes=0))
    msgs = [_msg(start + timedelta(minutes=i * step_min), lon, lat + i * 1e-4, speed=speed)
            for i in range(n)]
    return AisTrack(mmsi=mmsi, name=f"MV {mmsi}", vessel_type="CARGO", messages=msgs,
                    source_state=AisSourceState.CONTROLLED, provider="CONTROLLED",
                    dataset="controlled-ais-v1")


def _candidate(mmsi, lon_off_km=0.0, release_offset_min=0, speed=10.0):
    lon = ORIGIN_LON + lon_off_km / (111.0 * 0.966)
    start = RELEASE + timedelta(minutes=release_offset_min)
    cand = build_candidate(
        _track(mmsi, lon, ORIGIN_LAT, start=start, speed=speed),
        ORIGIN_LON, ORIGIN_LAT,
        RELEASE - timedelta(hours=48), RELEASE + timedelta(hours=24),
        radius_km=50,
    )
    assert cand is not None, f"candidate {mmsi} should survive filtering"
    return cand


def _ctx(fan=None, env=None):
    return ScoreContext(
        origin_lon=ORIGIN_LON, origin_lat=ORIGIN_LAT, release_time=RELEASE,
        search_radius_km=50.0,
        backtracking_fan=fan or [
            {"endpoints": [{"lon": ORIGIN_LON, "lat": ORIGIN_LAT}] * 4} for _ in range(6)
        ],
        environment=env,
    )


def test_frozen_weights_sum_to_one():
    assert abs(sum(FIVE_FACTOR_WEIGHTS.values()) - 1.0) < 1e-9
    assert set(FIVE_FACTOR_WEIGHTS) == {
        "spatial", "temporal", "trajectory", "anomaly", "environmental",
    }


def test_spatial_monotonic_with_distance():
    near = factor_spatial(_candidate("a", lon_off_km=0))[0]
    far = factor_spatial(_candidate("b", lon_off_km=25))[0]
    assert near > far
    assert 0.0 <= near <= 1.0 and 0.0 <= far <= 1.0


def test_temporal_perfect_alignment_is_one():
    cand = _candidate("t", release_offset_min=0)
    s, ev = factor_temporal(cand, RELEASE)
    assert s == 1.0
    assert ev["time_diff_hours"] == 0.0


def test_temporal_neutral_without_release_time():
    cand = _candidate("t", release_offset_min=10)
    s, ev = factor_temporal(cand, None)
    assert s == 0.5 and "neutral" in ev["note"]


def test_trajectory_near_fan_beats_far():
    fan = _ctx().backtracking_fan
    near = factor_trajectory(_candidate("a", lon_off_km=0), fan, RELEASE)[0]
    far = factor_trajectory(_candidate("b", lon_off_km=40), fan, RELEASE)[0]
    assert near > far


def test_trajectory_neutral_without_fan():
    s, ev = factor_trajectory(_candidate("a", lon_off_km=0), None, RELEASE)
    assert s == 0.5 and "neutral" in ev["note"]


def test_anomaly_factor_zero_when_clean():
    cand = _candidate("a", lon_off_km=0)
    assert factor_anomaly(cand)[0] == 0.0


def test_anomaly_factor_strong_signal():
    cand = _candidate("a", lon_off_km=0)
    cand.anomalies = [
        AnomalySignal(kind="loiter", timestamp=RELEASE, metric=0.5,
                      detail="loiter at origin at release time")
    ]
    s, ev = factor_anomaly(cand)
    assert s >= 0.6 and ev["n_strong"] >= 1


def test_environmental_neutral_without_forcing():
    cand = _candidate("a", lon_off_km=0)
    s, ev = factor_environmental(cand, None)
    assert s == 0.5 and "neutral" in ev["note"]


def test_quality_block_does_not_affect_composite():
    cand_a = _candidate("a", lon_off_km=0)
    cand_b = _candidate("b", lon_off_km=0)
    cand_b.reliability = "HIGH"
    cand_b.reliability_notes = ["dense"]
    ctx = _ctx()
    a = score_candidate(cand_a, ctx)
    b = score_candidate(cand_b, ctx)
    assert a["score"] == b["score"]  # reliability is NOT part of the score
    assert a["factors"] == b["factors"]


def test_scored_output_fields():
    cand = _candidate("a", lon_off_km=0)
    out = score_candidate(cand, _ctx())
    assert set(out["factors"]) == set(FIVE_FACTOR_WEIGHTS)
    assert "factor_evidence" in out and "data_quality" in out
    assert out["data_quality"]["reliability"] in ("HIGH", "MEDIUM", "LOW")
    assert "mmsi" in out


def test_rank_vessels_descending_with_ranks():
    cands = [_candidate("at", lon_off_km=0), _candidate("late", lon_off_km=0, release_offset_min=60)]
    res = rank_vessels(cands, _ctx())
    assert [v["rank"] for v in res["ranked_vessels"]] == [1, 2]
    assert res["ranked_vessels"][0]["score"] >= res["ranked_vessels"][1]["score"]
    assert res["weights_used"] == {k: round(v, 3) for k, v in FIVE_FACTOR_WEIGHTS.items()}
    assert res["attribution_model_version"].startswith("ais-scoring-v1")


def test_rank_inconclusive_when_no_candidates():
    res = rank_vessels([], _ctx())
    assert res["conclusion"] == "inconclusive"
    assert res["warnings"]


def test_rank_inconclusive_when_thin_margin():
    cands = [
        _candidate("a", lon_off_km=0),
        _candidate("b", lon_off_km=0.0005, release_offset_min=2),
    ]
    res = rank_vessels(cands, _ctx())
    assert res["ranking"]["margin"] < DECISIVE_MARGIN
    assert res["conclusion"] == "inconclusive"


def test_rank_rejects_bad_weights():
    with pytest.raises(ValueError):
        rank_vessels([_candidate("a", lon_off_km=0)], _ctx(), weights={"spatial": 1.0})
    with pytest.raises(ValueError):
        rank_vessels([_candidate("a", lon_off_km=0)], _ctx(), weights={"made_up": 1.0})


def test_scored_candidate_warnings_for_neutral_factors():
    # No fan + no forcing -> both neutral, warnings recorded.
    cand = _candidate("a", lon_off_km=0)
    out = score_candidate(cand, ScoreContext(
        origin_lon=ORIGIN_LON, origin_lat=ORIGIN_LAT, release_time=RELEASE,
        search_radius_km=50.0, backtracking_fan=None, environment=None,
    ))
    notes = out["warnings"]
    assert any("trajectory" in n for n in notes)
    assert any("environmental" in n for n in notes)