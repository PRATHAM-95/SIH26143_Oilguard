"""Wire-contract tests for the STEP 10 AIS + attribution endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ORIGIN_O = {"lat": 15.0, "lon": 72.4}
START = "2026-08-02T18:00:00Z"
END = "2026-08-05T18:00:00Z"


def test_ais_availability():
    r = client.get("/api/ais/availability")
    assert r.status_code == 200
    body = r.json()["ais"]
    assert body["controlled"]["state"] == "CONTROLLED"
    assert body["gfw"]["state"] == "UNAVAILABLE"


def test_ais_query_returns_controlled_tracks():
    r = client.post("/api/ais/query", json={
        "origin": ORIGIN_O, "timeStart": START, "timeEnd": END, "radiusKm": 50,
        "source": "CONTROLLED",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["sourceState"] == "CONTROLLED"
    assert data["provider"] == "CONTROLLED"
    assert data["vesselCount"] == len(data["tracks"])
    for t in data["tracks"]:
        assert t["sourceState"] == "CONTROLLED"
        assert t["messages"], "every returned track has position reports"


def test_ais_query_unavailable_provider_503():
    r = client.post("/api/ais/query", json={
        "origin": ORIGIN_O, "timeStart": START, "timeEnd": END, "radiusKm": 50,
        "source": "GFW",
    })
    assert r.status_code == 503
    assert "UNAVAILABLE" in r.json()["detail"]


def test_ais_query_rejects_bad_source():
    r = client.post("/api/ais/query", json={
        "origin": ORIGIN_O, "timeStart": START, "timeEnd": END, "radiusKm": 50,
        "source": "NOT_A_SOURCE",
    })
    assert r.status_code in (400, 422)


def _query_tracks():
    r = client.post("/api/ais/query", json={
        "origin": ORIGIN_O, "timeStart": START, "timeEnd": END, "radiusKm": 60,
        "source": "CONTROLLED", "seed": 26143,
    })
    assert r.status_code == 200, r.text
    return r.json()["tracks"]


def test_ais_filter_wire_path():
    tracks = _query_tracks()
    r = client.post("/api/ais/filter", json={
        "origin": ORIGIN_O,
        "timeRange": {"earliest": START, "latest": END, "preferred": "2026-08-04T18:00:00Z"},
        "radiusKm": 50,
        "maxGapMin": 30,
        "tracks": tracks,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["kept"] == len(data["candidates"])
    assert data["dropped"] == len(data["droppedVessels"])
    for c in data["candidates"]:
        assert c["reliability"] in ("HIGH", "MEDIUM", "LOW")
        assert c["track"]["mmsi"] == c["mmsi"]


def test_score_vessels_wire_path():
    tracks = _query_tracks()
    f = client.post("/api/ais/filter", json={
        "origin": ORIGIN_O,
        "timeRange": {"earliest": START, "latest": END, "preferred": "2026-08-04T18:00:00Z"},
        "radiusKm": 50,
        "tracks": tracks,
    })
    cands = f.json()["candidates"]
    r = client.post("/api/score-vessels", json={
        "candidates": cands,
        "origin": ORIGIN_O,
        "releaseTime": "2026-08-04T18:00:00Z",
        "searchRadiusKm": 50,
        "backtracking": {
            "origin": ORIGIN_O,
            "timeRange": {"earliest": START, "latest": END},
            "trajectories": [
                {"member": 0, "particle": 0, "endpoints": [
                    {"lon": 72.4, "lat": 15.0}, {"lon": 72.45, "lat": 15.02},
                ]},
            ],
        },
        "environment": {"uCurrent": 0.35, "vCurrent": 0.0, "uWind": -1.5, "vWind": 0.5},
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "completed"
    assert data["conclusion"] in ("candidate", "inconclusive")
    assert data["weightsUsed"] == {
        "spatial": 0.25, "temporal": 0.2, "trajectory": 0.25, "anomaly": 0.15, "environmental": 0.15,
    }
    ranks = [v["rank"] for v in data["rankedVessels"]]
    assert ranks == sorted(ranks)
    for v in data["rankedVessels"]:
        assert "data_quality" in v
        assert set(v["factors"]) == {
            "spatial", "temporal", "trajectory", "anomaly", "environmental",
        }


def test_attribution_validate_endpoint():
    r = client.post("/api/attribution/validate", json={"scenario": "easy-tanker"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["scenarios"][0]["top1_hit"] is True


def test_attribution_validate_unknown_scenario():
    r = client.post("/api/attribution/validate", json={"scenario": "nonexistent"})
    assert r.status_code == 422


def test_root_lists_new_endpoints():
    r = client.get("/")
    assert r.status_code == 200
    eps = r.json()["endpoints"]
    assert "/api/ais/availability" in eps
    assert "/api/ais/query" in eps
    assert "/api/score-vessels" in eps
    assert r.json()["version"] == "0.5.0"