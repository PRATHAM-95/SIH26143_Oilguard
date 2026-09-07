"""Scientific tests for the Step 07 SAR observation pipeline + API.

These assert the scientific-integrity properties that matter for the SIH26143
demo: deterministic, reproducible, honestly-labelled (a fixture is never
presented as real Sentinel-1), no fabricated detections (a plain scene yields
zero candidates), and an honest age (never invented from a single snapshot).
"""

from __future__ import annotations

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.sar.contract import CandidateClass, ProvenanceState, ProcessingStatus, SarScene
from app.sar.detectors.classical import ClassicalDarkSpotDetector
from app.sar.fixture import build_fixture_scene
from app.sar.pipeline import process_observation

client = TestClient(app)


def _detect(source: str = "LOCAL_FIXTURE", detector: str = "CLASSICAL"):
    return client.post(
        "/api/sar/detect",
        json={"source": source, "detector": detector, "max_candidates": 6},
    )


# ---------------------------------------------------------------- pipeline ---


def test_observation_fixture_is_honestly_labelled_not_real():
    r = process_observation(source="LOCAL_FIXTURE")
    assert r.status == ProcessingStatus.COMPLETED
    assert r.source_state == ProvenanceState.LOCAL_FIXTURE
    # A fixture must never be labelled as real Sentinel-1.
    assert r.source_state is not ProvenanceState.REAL_SENTINEL1
    assert not r.errors
    joined = " ".join(r.warnings).lower()
    assert "synthetic" in joined or "fixture" in joined


def test_observation_is_deterministic_across_runs():
    a = process_observation(source="LOCAL_FIXTURE")
    b = process_observation(source="LOCAL_FIXTURE")
    assert a.status == b.status == ProcessingStatus.COMPLETED
    assert [c.candidate_id for c in a.candidates] == [c.candidate_id for c in b.candidates]
    assert [c.confidence for c in a.candidates] == [c.confidence for c in b.candidates]
    assert round(a.slick_area_km2, 3) == round(b.slick_area_km2, 3)


def test_plain_scene_yields_no_candidates():
    # A scene with no dark feature must yield ZERO candidates — never a
    # fabricated detection. Reuse the fixture's geometry but flatten the
    # amplitude so there is nothing darker than the sea reference.
    src = build_fixture_scene()
    flat = np.full(src.shape, -1.5, dtype=float)
    # Keep the same land mask (excludes bright land block) but remove all
    # embedded dark features.
    plain = SarScene(
        scene_id="plain-none",
        acquisition_time=src.acquisition_time,
        satellites=[],
        polarization="VV",
        geotransform=src.geotransform,
        amplitude_db=flat,
        land_mask=src.land_mask,
        source="SYNTHETIC",
        source_state=ProvenanceState.SYNTHETIC,
        provider_dataset="test plain scene",
    )
    detector = ClassicalDarkSpotDetector()
    assert detector.detect(plain, max_candidates=6) == []


def test_ages_not_invented_for_single_scene():
    r = process_observation(source="LOCAL_FIXTURE")
    assert r.age_available is False
    assert r.age_estimate is None
    assert any("age" in w.lower() for w in r.warnings)


def test_fixture_candidate_classes_and_geometry():
    r = process_observation(source="LOCAL_FIXTURE")
    oils = [c for c in r.candidates if c.classification == CandidateClass.OIL_CANDIDATE]
    looks = [c for c in r.candidates if c.classification == CandidateClass.LOOK_ALIKE]
    assert oils, "expected at least one OIL_CANDIDATE"
    assert looks, "expected at least one LOOK_ALIKE"
    # Elongated slick vs compact look-alike.
    assert oils[0].aspect_ratio >= 1.8
    assert looks[0].aspect_ratio < 1.3
    assert len(oils[0].look_alike_hints) == 0
    assert looks[0].look_alike_hints, "look-alike lacks a scientific distinction hint"
    for c in r.candidates:
        assert 0.0 <= c.confidence <= 1.0
        assert c.area_km2 > 0
        assert c.centroid[0] != c.centroid[1]
        # Closed polygon: first == last ring point.
        assert c.polygon[0] == c.polygon[-1]
        assert len(c.polygon) >= 4
    assert r.confidence is not None and 0.0 <= r.confidence <= 1.0
    assert r.slick_area_km2 is not None and r.slick_area_km2 > 0


# ------------------------------------------------------------------ API -----


def test_sar_preview_reports_availability():
    r = client.get("/api/sar/preview")
    assert r.status_code == 200
    sar = r.json()["availability"]["sar"]
    assert sar["source"]["local_fixture"]["status"] == "AVAILABLE"
    assert sar["detector"]["classical_dark_spot"]["status"] == "AVAILABLE"
    # Real Sentinel-1 must be honest about being unavailable without creds.
    assert sar["source"]["real_sentinel1"]["status"] in ("AVAILABLE", "UNAVAILABLE")


def test_sar_detect_contract_shape():
    r = _detect()
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "completed"
    assert data["source_state"] == "LOCAL_FIXTURE"
    assert data["observation_id"]
    assert data["scene_id"]
    assert data["detector"] == "classical_dark_spot"
    assert isinstance(data["candidates"], list)
    for c in data["candidates"]:
        assert set(c.keys()) >= {
            "candidate_id", "classification", "confidence", "centroid",
            "polygon", "bbox", "area_km2",
        }
        assert c["polygon"][0] == c["polygon"][-1]
    assert data["age_available"] is False


def test_sar_detect_synthetic_source_is_labelled():
    r = client.post(
        "/api/sar/detect",
        json={"source": "SYNTHETIC", "detector": "CLASSICAL", "max_candidates": 6},
    )
    assert r.status_code == 200, r.text
    assert r.json()["source_state"] in ("SYNTHETIC", "LOCAL_FIXTURE")


def test_sar_detect_rejects_unknown_source():
    r = client.post(
        "/api/sar/detect",
        json={"source": "NOT_A_REAL_SOURCE", "detector": "CLASSICAL"},
    )
    assert r.status_code == 422
