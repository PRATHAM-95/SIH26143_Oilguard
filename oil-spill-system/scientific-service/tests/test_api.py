"""FastAPI wire-contract tests for the frozen §15.2 forward-drift endpoint."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_BODY = {
    "origin": {"lat": 7.64, "lon": 75.14},
    "time": "2026-09-02T12:00:00Z",
    "duration_hours": 6,
    "currents": {"u": 0.0, "v": 0.0},
    "wind": {"u": 0.0, "v": 0.0},
    "oilType": "GENERIC CRUDE",
    "particleCount": 200,
}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "UP"


def test_forward_drift_contract_shape():
    r = client.post("/api/forward-drift", json=VALID_BODY)
    assert r.status_code == 200, r.text
    data = r.json()
    # Frozen §15.2 fields must be present with the correct structure.
    assert "particles" in data
    for p in data["particles"]:
        assert set(p.keys()) == {"lon", "lat", "z", "mass_kg"}
    extent = data["extent"]
    assert extent["type"] == "Polygon"
    assert isinstance(extent["coordinates"], list)
    mb = data["massBalance"]
    assert set(mb.keys()) == {"evaporated_kg", "dispersed_kg", "remaining_kg"}


def test_forward_drift_rejects_zero_origin():
    body = dict(VALID_BODY)
    body["origin"] = {"lat": 0.0, "lon": 0.0}
    r = client.post("/api/forward-drift", json=body)
    assert r.status_code == 400


def test_forward_drift_rejects_bad_oil_type():
    body = dict(VALID_BODY)
    body["oilType"] = "NOT-A-REAL-OIL"
    r = client.post("/api/forward-drift", json=body)
    assert r.status_code == 422
    assert "oil type" in r.json()["detail"].lower() or "Unknown oil type" in r.json()["detail"]


def test_forward_drift_rejects_out_of_range_lat():
    body = dict(VALID_BODY)
    body["origin"] = {"lat": 95.0, "lon": 75.14}
    r = client.post("/api/forward-drift", json=body)
    assert r.status_code == 422


def test_forward_drift_rejects_negative_duration():
    body = dict(VALID_BODY)
    body["duration_hours"] = -3
    r = client.post("/api/forward-drift", json=body)
    assert r.status_code == 422


def test_forward_drift_rejects_zero_particles():
    body = dict(VALID_BODY)
    body["particleCount"] = 0
    r = client.post("/api/forward-drift", json=body)
    assert r.status_code == 422


def test_forward_drift_preview():
    r = client.get("/api/forward-drift/preview")
    assert r.status_code == 200
    data = r.json()
    assert "oil_types" in data and len(data["oil_types"]) > 100
    assert "default_oil_type" in data
    assert "environment_availability" in data
    assert data["environment_availability"]["environment"]["controlled"]["status"] == "AVAILABLE"


def test_environment_availability_endpoint():
    r = client.get("/api/environment/availability")
    assert r.status_code == 200
    env = r.json()["environment"]
    assert env["controlled"]["status"] == "AVAILABLE"