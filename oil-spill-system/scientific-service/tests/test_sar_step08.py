"""Scientific tests for Step 08: real Sentinel-1 catalog path + detector hardening.

These assert the scientific-integrity properties that Step 08 adds on top of
Step 07:

  * the anonymous Copernicus Data Space STAC catalog search returns *real*
    product metadata and never substitutes a fabricated scene;
  * the catalog remains honest (unavailable -> structured reason) when the
    network is unreachable;
  * the REAL_SENTINEL1 source is credential-gated and reports the exact blocker
    without credentials;
  * the hardened classical detector reports a local-contrast (dB) metric and
    gates confidence on weak contrast;
  * incidence-angle metadata (real GRD) qualifies confidence but is never
    invented.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.sar.catalog import _normalize_feature, _contains_polarization
from app.sar.contract import CandidateClass, ProvenanceState, SarScene
from app.sar.detectors.classical import ClassicalDarkSpotDetector
from app.sar.fixture import build_fixture_scene
from app.sar.scenes import RealSentinel1Provider, SarSourceError

import numpy as np

client = TestClient(app)

# A realistic STAC GRD feature (subset of what the CDSE catalog returns).
SAMPLE_FEATURE = {
    "type": "Feature",
    "id": "S1D_IW_GRDH_1SDV_20260901T005520_20260901T005534_004377_008165_2343_COG",
    "bbox": [71.0, 13.0, 74.0, 16.0],
    "geometry": {"type": "Polygon", "coordinates": [[[71, 13], [74, 13], [74, 16], [71, 16], [71, 13]]]},
    "properties": {
        "datetime": "2026-09-01T00:55:20.579108Z",
        "instruments": ["c-sar"],
        "sar:polarizations": ["VV", "VH"],
        "sar:instrument_mode": "IW",
        "sat:orbit_state": "descending",
        "sat:relative_orbit": 121,
        "s1:product_id": "S1D_IW_GRDH_1SDV_20260901T005520_20260901T005534_004377_008165_2343_COG",
        "s1:resolution_class": "HIGH",
    },
}


# ------------------------------------------------------------ catalog helpers ---


def test_normalize_feature_extracts_real_fields():
    p = _normalize_feature(SAMPLE_FEATURE)
    assert p is not None
    assert p.product_id == SAMPLE_FEATURE["id"]
    assert p.acquisition_time == "2026-09-01T00:55:20.579108Z"
    assert p.polarization == "VV,VH"
    assert p.orbit_state == "descending"
    assert p.instrument_mode == "IW"
    assert p.relative_orbit == 121
    assert p.footprint["type"] == "Polygon"
    assert p.bbox == [71.0, 13.0, 74.0, 16.0]


def test_contains_polarization_is_honest():
    assert _contains_polarization("VV,VH", "VV") is True
    assert _contains_polarization("HH,HV", "VV") is False
    # Missing polarization is NOT assumed to contain the requested band.
    assert _contains_polarization(None, "VV") is False


def test_catalog_endpoint_works_offline_with_reason():
    # Deterministic: the endpoint must always return a well-formed report even
    # when the network is absent (structured "unavailable", never a fabrication).
    r = client.get("/api/sar/catalog")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in ("available", "unavailable", "failed")
    assert body["reason"]
    assert body["technical"]["type"] == "copernicus_data_space_stac"
    assert body["technical"]["anonymous_search"] is True
    # If a live search succeeded, every product must carry a real product id.
    if body["status"] == "available":
        assert body["product_count"] == len(body["products"])
        for p in body["products"]:
            assert p["product_id"]
            assert p["footprint"]["type"] == "Polygon"


# ------------------------------------------------------ real-source gating ---


def test_real_sentinel1_is_credential_gated():
    # Without CDSE credentials the real provider must report the blocker, not
    # silently fall back to a fixture.
    provider = RealSentinel1Provider()
    try:
        provider.get(polarization="VV")
        raised = False
    except SarSourceError as exc:
        raised = True
        msg = str(exc)
        assert "CDSE" in msg or "credentials" in msg.lower() or "CDSE_USERNAME" in msg
    assert raised, "expected SarSourceError without CDSE credentials"


def test_detect_request_real_sentinel1_reports_unavailable():
    r = client.post(
        "/api/sar/detect",
        json={"source": "REAL_SENTINEL1", "detector": "CLASSICAL"},
    )
    assert r.status_code == 200
    body = r.json()
    # Status is "unavailable" — no scene was produced. source_state reflects
    # the *requested* provenance intent; warnings carry the exact blocker, so
    # nothing here implies a real scene was actually obtained.
    assert body["status"] == "unavailable"
    assert body["source_state"] == "REAL_SENTINEL1"
    assert body["candidates"] == []
    joined = " ".join(body["warnings"] + body["errors"]).lower()
    assert "unavailable" in joined


# -------------------------------------------------- detector hardening ---


def test_fixture_candidates_report_contrast_db():
    r = client.post(
        "/api/sar/detect",
        json={"source": "LOCAL_FIXTURE", "detector": "CLASSICAL", "max_candidates": 6},
    )
    assert r.status_code == 200
    cands = r.json()["candidates"]
    assert cands, "expected candidates"
    for c in cands:
        assert "contrast_db" in c
        assert c["contrast_db"] is None or c["contrast_db"] > 0
    # The elongated oil-like candidate is the strongest, and its contrast must
    # be physically sensible (a real slick stands out from the sea reference).
    oil = [c for c in cands if c["classification"] == "OIL_CANDIDATE"]
    assert oil and oil[0]["contrast_db"] is not None and oil[0]["contrast_db"] >= 5.0
    # Detector reports its hardened version.
    assert r.json()["detector_version"].startswith("2.")


def test_weak_contrast_downgrades_confidence():
    # A dark-but-faint region (contrast below the strong-slick regime) must be
    # downgraded / flagged rather than reported as a confident slick.
    src = build_fixture_scene()
    amp = np.asarray(src.amplitude_db, dtype=float).copy()
    # Create an elongated dark region with only ~2 dB of contrast.
    rows, cols = amp.shape
    rs, cs = np.indices(amp.shape)
    ripple = ((rs - int(rows * 0.1)) ** 2 / (rows * 0.008) ** 2
              + (cs - int(cols * 0.2)) ** 2 / (cols * 0.15) ** 2) <= 1.0
    amp[ripple] -= 2.0
    scene = SarScene(
        scene_id="lowcontrast",
        acquisition_time=src.acquisition_time,
        satellites=[],
        polarization="VV",
        geotransform=src.geotransform,
        amplitude_db=amp,
        land_mask=src.land_mask,
        source="SYNTHETIC",
        source_state=ProvenanceState.SYNTHETIC,
        provider_dataset="test low-contrast scene",
    )
    detector = ClassicalDarkSpotDetector()
    low = [c for c in detector.detect(scene, max_candidates=6)
           if c.contrast_db is not None and c.contrast_db < 3.0]
    for c in low:
        assert c.confidence <= 0.4
        assert any("contrast" in w for w in c.warnings)


def test_incidence_metadata_qualifies_not_invents():
    # When a scene carries per-pixel incidence metadata, the candidate records a
    # mean incidence angle and low angles caution against high confidence; when
    # absent, incidence is None (never invented).
    src = build_fixture_scene()
    amp = np.asarray(src.amplitude_db, dtype=float).copy()
    inc = np.full(amp.shape, 30.0)
    scene = SarScene(
        scene_id="inc",
        acquisition_time=src.acquisition_time,
        satellites=[],
        polarization="VV",
        geotransform=src.geotransform,
        amplitude_db=amp,
        land_mask=src.land_mask,
        source="SYNTHETIC",
        source_state=ProvenanceState.SYNTHETIC,
        provider_dataset="test incidence scene",
        incidence_deg=inc,
    )
    detector = ClassicalDarkSpotDetector()
    cands = detector.detect(scene, max_candidates=6)
    for c in cands:
        assert c.incidence_deg is not None and c.incidence_deg == 30.0

    # Fixture scenes carry no incidence metadata -> None (not fabricated).
    base = detector.detect(src, max_candidates=6)
    for c in base:
        assert c.incidence_deg is None
