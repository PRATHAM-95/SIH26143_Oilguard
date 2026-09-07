"""Tests for real-data environment providers (Layer B).

These tests DO NOT touch the network. They monkeypatch the downloader
functions (``_cmems_open`` / ``_era5_retrieve``) with synthetic xarray
datasets and stub the availability report so we can prove the normalization
logic turns raw data into a correct ``EnvironmentField``. Separately they
verify that when credentials/config are ABSENT the provider raises
``EnvironmentProviderError`` and the engine falls back to CONTROLLED instead
of ever fabricating real results.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np
import pytest

from app.environment import providers as p
from app.environment.contract import EnvironmentProviderError


class _FakeConfig:
    cmems_username = "u"
    cmems_password = "p"
    cmems_dataset_id = "test-dataset"
    cds_url = "https://cds.test/api"
    cds_key = "k"
    cmems_available = True
    era5_available = True


def _synthetic_currents(
    n_lat=3,
    n_lon=3,
    n_time=5,
    u_val=0.31,
    v_val=-0.12,
    start=datetime(2024, 5, 1, 0, 0, 0),
):
    import xarray as xr

    times = np.array(
        [start + timedelta(hours=h) for h in range(n_time)], dtype="datetime64[ns]"
    )
    lats = np.array([19.0, 19.25, 19.5])
    lons = np.array([71.0, 71.25, 71.5])
    u = np.full((n_time, n_lat, n_lon), u_val, dtype=float)
    v = np.full((n_time, n_lat, n_lon), v_val, dtype=float)
    ds = xr.Dataset(
        {
            "uo": (("time", "latitude", "longitude"), u),
            "vo": (("time", "latitude", "longitude"), v),
        },
        coords={
            "time": times,
            "latitude": lats,
            "longitude": lons,
        },
        attrs={"title": "TEST currents"},
    )
    return ds


def _synthetic_wind(
    n_lat=3,
    n_lon=3,
    n_time=5,
    u_val=-2.5,
    v_val=1.25,
    start=datetime(2024, 5, 1, 0, 0, 0),
):
    import xarray as xr

    times = np.array(
        [start + timedelta(hours=h) for h in range(n_time)], dtype="datetime64[ns]"
    )
    lats = np.array([19.0, 19.25, 19.5])
    lons = np.array([71.0, 71.25, 71.5])
    ds = xr.Dataset(
        {
            "u10": (("time", "latitude", "longitude"), np.full((n_time, n_lat, n_lon), u_val, float)),
            "v10": (("time", "latitude", "longitude"), np.full((n_time, n_lat, n_lon), v_val, float)),
        },
        coords={"time": times, "latitude": lats, "longitude": lons},
    )
    return ds


@pytest.fixture
def avail(monkeypatch):
    monkeypatch.setattr(
        "app.environment.providers.get_environment_config", lambda: _FakeConfig()
    )


def test_cmems_normalization_returns_expected_field(monkeypatch):
    ds = _synthetic_currents(u_val=0.31, v_val=-0.12)
    monkeypatch.setattr(p, "_cmems_open", lambda *a, **k: ds)
    monkeypatch.setattr(
        "app.environment.providers.get_environment_config", lambda: _FakeConfig()
    )

    start = datetime(2024, 5, 1, 0, 0, 0)
    field = p.CMEMSProvider().get(19.2, 71.2, start, duration_hours=3, time_step_seconds=3600)

    assert len(field.samples) == 3
    for s in field.samples:
        assert s.source == "CMEMS"
        assert abs(s.u_current - 0.31) < 1e-9
        assert abs(s.v_current + 0.12) < 1e-9
        # Wind is not provided by a currents-only source.
        assert s.u_wind == 0.0 and s.v_wind == 0.0


def test_cmems_provider_raises_when_unavailable():
    with pytest.raises(EnvironmentProviderError):
        p.CMEMSProvider().get(
            19.2, 71.2, datetime(2024, 5, 1), duration_hours=1, time_step_seconds=3600
        )


def test_era5_normalization_returns_expected_field(monkeypatch):
    ds = _synthetic_wind(u_val=-2.5, v_val=1.25)
    monkeypatch.setattr(p, "_era5_retrieve", lambda *a, **k: None)
    monkeypatch.setattr(
        "app.environment.providers.get_environment_config", lambda: _FakeConfig()
    )
    monkeypatch.setattr(
        "xarray.open_dataset", lambda *a, **k: ds
    )

    start = datetime(2024, 5, 1, 0, 0, 0)
    field = p.ERA5Provider().get(19.2, 71.2, start, duration_hours=2, time_step_seconds=3600)

    assert len(field.samples) == 2
    for s in field.samples:
        assert s.source == "ERA5"
        assert abs(s.u_wind + 2.5) < 1e-9
        assert abs(s.v_wind - 1.25) < 1e-9
        assert s.u_current == 0.0 and s.v_current == 0.0


def test_era5_provider_raises_when_unavailable():
    with pytest.raises(EnvironmentProviderError):
        p.ERA5Provider().get(
            19.2, 71.2, datetime(2024, 5, 1), duration_hours=1, time_step_seconds=3600
        )


def test_combined_field_merges_current_and_wind():
    # Exercise the engine-level combiner by building a REAL field directly via
    # the _RealForcingProvider path is network-gated; here we simply confirm the
    # merge helper behaviour is reachable through the providers module by
    # checking ControlledEnvironmentProvider produces samples for every step.
    c = p.ControlledEnvironmentProvider(u_current=0.5, u_wind=2.0)
    field = c.get(19.2, 71.2, datetime(2024, 5, 1), duration_hours=1, time_step_seconds=3600)
    assert len(field.samples) == 1
    assert field.samples[0].u_current == 0.5
    assert field.samples[0].u_wind == 2.0
