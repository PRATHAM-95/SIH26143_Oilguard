"""Controlled recovery validation for the attribution stage (STEP 10).

Ground truth is enclosed in the validation harness; the served API path never
sees it. Results are measured — nothing is fabricated. Writing the artifact
(`research/25-ais-attribution/step10_validation_results.json`) is gated behind
AIS_VALIDATION_WRITE_ARTIFACT=1 so unit runs never touch the research area.
"""

from __future__ import annotations

import os
import sys

import pytest

from app.ais.validation import SCENARIOS, run_all_scenarios, run_scenario


def _should_write() -> bool:
    return os.getenv("AIS_VALIDATION_WRITE_ARTIFACT") == "1"


def test_every_scenario_runs_and_reports_measured_fields():
    for key in SCENARIOS:
        r = run_scenario(SCENARIOS[key])
        assert r["scenario"] == key
        assert isinstance(r["top1_hit"], bool)
        assert isinstance(r["top3_hit"], bool)
        assert 0.0 <= r["mrr"] <= 1.0
        assert r["input_vessels"] >= 1
        assert 0.0 <= r["reduction_ratio"] <= 1.0
        # provenance stays controlled everywhere
        assert r["source_state_seen"] == ["CONTROLLED"]


def test_attributable_scenarios_top1_target():
    for key in ("easy-tanker", "mid-cargo-maneuver", "hard-trawler-loiter-gap", "distractor-rich-false-friend"):
        r = run_scenario(SCENARIOS[key])
        assert r["top1_hit"] is True, f"{key}: expected the planted vessel at rank 1"
        assert r["top3_hit"] is True


def test_no_vessel_scenario_inconclusive():
    r = run_scenario(SCENARIOS["no-vessel-inconclusive"])
    assert r["conclusion"] == "inconclusive"


def test_clean_traffic_control_inconclusive():
    r = run_scenario(SCENARIOS["clean-traffic-control"])
    assert r["conclusion"] == "inconclusive"
    assert r["top1_mmsi"] is None or r["top_score"] < 0.5


def test_aggregate_metrics_meet_targets():
    p = run_all_scenarios()
    m = p["metrics"]
    assert m["top1_rate"] > 0.7   # §18.3 target
    assert m["top3_rate"] > 0.9   # §18.3 target
    assert m["expectation_satisfied"] is True


def test_artifact_write_is_opt_in(tmp_path, monkeypatch):
    # Without the env flag (even when requested) we must not write to the repo.
    monkeypatch.setenv("AIS_VALIDATION_WRITE_ARTIFACT", "")
    p = run_all_scenarios(only="easy-tanker")
    assert "artifact_path" not in p


@pytest.mark.skipif(not _should_write(), reason="AIS_VALIDATION_WRITE_ARTIFACT=1 required")
def test_write_validation_artifact():
    p = run_all_scenarios(write_artifact=True)
    assert p["metrics"]["expectation_satisfied"] is True
    assert "artifact_path" in p
    assert os.path.exists(p["artifact_path"])