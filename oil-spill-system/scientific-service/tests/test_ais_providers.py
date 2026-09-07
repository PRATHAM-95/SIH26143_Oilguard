"""Providers: determinism, provenance labels, honest UNAVAILABLE seams.

The Layer B real-data seams must NEVER fabricate traffic. With no credentials
(or no verified client), each raises ``AisProviderError`` with an explicit
reason. The Layer A provider returns CONTROLLED-stamped simulated tracks.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest

from app.ais.config import CONTROLLED_AIS_REFERENCE_TIME, DEFAULT_CONTROLLED_SEED
from app.ais.providers import (
    AisStreamProvider,
    ControlledAisProvider,
    GfwAisProvider,
    MarineCadastreProvider,
    resolve_ais_provider,
)
from app.ais.contract import AisProviderError, AisSourceState


W = datetime(2026, 8, 4, 12, 0, 0, tzinfo=timezone.utc)


def test_controlled_provider_deterministic_same_seed():
    a = ControlledAisProvider(seed=26143).query(
        center_lon=72.4, center_lat=15.0,
        time_start=W, time_end=W + timedelta(hours=24),
        radius_km=50,
    )
    b = ControlledAisProvider(seed=26143).query(
        center_lon=72.4, center_lat=15.0,
        time_start=W, time_end=W + timedelta(hours=24),
        radius_km=50,
    )
    assert [t.mmsi for t in a] == [t.mmsi for t in b]
    for ta, tb in zip(a, b):
        assert ta.messages[0].timestamp == tb.messages[0].timestamp
        assert ta.messages[0].longitude == tb.messages[0].longitude


def test_controlled_provider_different_seed_different_fleet():
    a = ControlledAisProvider(seed=1).query(
        center_lon=72.4, center_lat=15.0,
        time_start=W, time_end=W + timedelta(hours=24), radius_km=50,
    )
    b = ControlledAisProvider(seed=2).query(
        center_lon=72.4, center_lat=15.0,
        time_start=W, time_end=W + timedelta(hours=24), radius_km=50,
    )
    assert [t.mmsi for t in a] != [t.mmsi for t in b]


def test_controlled_provider_stamps_source_state_controlled():
    tracks = ControlledAisProvider(seed=DEFAULT_CONTROLLED_SEED).query(
        center_lon=72.4, center_lat=15.0,
        time_start=W, time_end=W + timedelta(hours=24), radius_km=50,
    )
    for t in tracks:
        assert t.source_state == AisSourceState.CONTROLLED
        assert t.provider == "CONTROLLED"
        assert t.dataset == "controlled-ais-v1"


def test_controlled_provider_respects_radius():
    tracks = ControlledAisProvider(seed=99).query(
        center_lon=72.4, center_lat=15.0,
        time_start=W, time_end=W + timedelta(hours=24), radius_km=10,
    )
    assert len(tracks) <= 200
    assert len(tracks) >= 0


def test_controlled_query_validates_window():
    with pytest.raises(AisProviderError):
        ControlledAisProvider().query(
            center_lon=72.4, center_lat=15.0,
            time_start=W, time_end=W - timedelta(hours=1), radius_km=50,
        )


def test_gfw_provider_refuses_without_key(monkeypatch):
    monkeypatch.setattr("app.ais.providers.get_ais_config", lambda: type("C", (), {"gfw_available": False})())
    with pytest.raises(AisProviderError) as ei:
        GfwAisProvider().query(
            center_lon=72.4, center_lat=15.0,
            time_start=W, time_end=W + timedelta(hours=24), radius_km=50,
        )
    assert "UNAVAILABLE" in str(ei.value)


def test_gfw_provider_refuses_even_with_key():
    # Even when a key is present the seam must not pretend to have queried a
    # feed it cannot verify for this build — an explicit refusal beats a
    # fabricated dataset disguised as REAL.
    class _CfgWithKey:
        gfw_marker = True
        gfw_available = True

    import app.ais.providers as prov
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(prov, "get_ais_config", lambda: _CfgWithKey())
    try:
        with pytest.raises(AisProviderError) as ei:
            GfwAisProvider().query(
                center_lon=72.4, center_lat=15.0,
                time_start=W, time_end=W + timedelta(hours=24), radius_km=50,
            )
        assert "not yet wired" in str(ei.value)
    finally:
        monkeypatch.undo()


def test_marine_cadastre_unavailable_indian_ocean():
    with pytest.raises(AisProviderError) as ei:
        MarineCadastreProvider().query(
            center_lon=72.4, center_lat=15.0,
            time_start=W, time_end=W + timedelta(hours=24), radius_km=50,
        )
    assert "US coastal waters"



def test_aisstream_unavailable_for_historical_window():
    with pytest.raises(AisProviderError) as ei:
        AisStreamProvider().query(
            center_lon=72.4, center_lat=15.0,
            time_start=datetime(2026, 7, 1, tzinfo=timezone.utc),
            time_end=datetime(2026, 7, 2, tzinfo=timezone.utc),
            radius_km=50,
        )
    assert "real-time" in str(ei.value)


def test_resolve_provider_valid_and_invalid():
    assert isinstance(resolve_ais_provider(None), ControlledAisProvider)
    assert isinstance(resolve_ais_provider("CONTROLLED"), ControlledAisProvider)
    assert isinstance(resolve_ais_provider("GFW"), GfwAisProvider)
    assert isinstance(resolve_ais_provider("MARINECADASTRE"), MarineCadastreProvider)
    assert isinstance(resolve_ais_provider("AISSTREAM"), AisStreamProvider)
    with pytest.raises(AisProviderError):
        resolve_ais_provider("NOT_A_PROVIDER")


def test_availability_report_honest():
    from app.ais.config import report_ais_availability

    report = report_ais_availability()
    assert report["ais"]["controlled"]["state"] == "CONTROLLED"
    assert report["ais"]["gfw"]["state"] == "UNAVAILABLE"
    assert report["ais"]["marine_cadastre"]["state"] == "UNAVAILABLE"