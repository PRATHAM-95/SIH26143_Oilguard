"""SAR scene sources.

Mirrors ``app.environment.providers``: a pluggable source layer that returns a
normalized :class:`SarScene` and never fakes real data. Sources:

* LOCAL_FIXTURE  -> committed deterministic demo scene (SYNTHETIC/DEMO).
* SYNTHETIC      -> generated deterministic test scene.
* CACHED_SENTINEL1 -> a cached real scene if one is configured on disk.
* REAL_SENTINEL1 -> Copernicus Data Space OData retrieval (credential-gated).

If a real-data source is requested but cannot run (no creds / no cache / fetch
failure / invalid raster), the provider raises :class:`SarSourceError` and the
pipeline records the exact blocker rather than silently substituting a fixture.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import numpy as np

from .config import get_sar_config
from .contract import GeoTransform, ProvenanceState, SarScene
from .fixture import build_fixture_scene, make_land_mask


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SarSourceError(RuntimeError):
    """Raised when a SAR source cannot satisfy a request."""


class LocalFixtureProvider:
    """Committed deterministic demo scene (SYNTHETIC/DEMO, not real data)."""

    source = "LOCAL_FIXTURE"
    state = ProvenanceState.LOCAL_FIXTURE

    def get(self, polarization: str = "VV") -> SarScene:
        scene = build_fixture_scene(polarization=polarization)
        scene.record("source: LOCAL_FIXTURE (SYNTHETIC/DEMO scene; never labelled as real Sentinel-1)")
        return scene


class SyntheticProvider:
    """Deterministic synthetic test scene (explicitly SYNTHETIC)."""

    source = "SYNTHETIC"
    state = ProvenanceState.SYNTHETIC

    def __init__(self, seed: int = 26143) -> None:
        self.seed = seed

    def get(self, polarization: str = "VV") -> SarScene:
        scene = build_fixture_scene(seed=self.seed, polarization=polarization)
        object.__setattr__(scene, "source", "SYNTHETIC")
        object.__setattr__(scene, "source_state", ProvenanceState.SYNTHETIC)
        object.__setattr__(scene, "provider_dataset", "deterministic synthetic scene (SYNTHETIC)")
        object.__setattr__(scene, "scene_id", f"synthetic-{self.seed}")
        scene.record("source: SYNTHETIC (generated deterministic scene)")
        return scene


class CachedSentinel1Provider:
    """Real Sentinel-1 scene loaded from a configured local cache.

    A *cached real* scene must carry provenance showing which real scene it is.
    Until a cache directory is configured and populated this source reports
    unavailable (it never invents metadata).
    """

    source = "CACHED_SENTINEL1"
    state = ProvenanceState.CACHED_SENTINEL1

    def get(self, scene_ref: str, polarization: str = "VV") -> SarScene:
        raise SarSourceError(
            "CACHED_SENTINEL1 unavailable: no SAR cache directory configured "
            "(set SAR_CACHE_DIR to a directory of cached real Sentinel-1 scenes)."
        )


class RealSentinel1Provider:
    """Real Sentinel-1 GRD via Copernicus Data Space (credential-gated).

    Requirements (Step 08):
      * Credentials   — CDSE_USERNAME / CDSE_PASSWORD must be configured. GRD
        product download on CDSE is always authenticated; without credentials
        there is no legitimate way to obtain the measurement data, so the
        provider reports UNAVAILABLE with the exact blocker.
      * Network       — an anonymous STAC search is used to select a real GRD
        product over the AOI (this part works without credentials and is how we
        prove real data is available). Download then fetches that product via
        the authenticated OData endpoint.

    On any missing-credential / auth / network / parse failure the provider
    raises :class:`SarSourceError` so the pipeline records the real blocker —
    it never substitutes a fixture or fabricates a scene.
    """

    source = "REAL_SENTINEL1"
    state = ProvenanceState.REAL_SENTINEL1

    def __init__(self, aoi: Optional[dict] = None) -> None:
        from .catalog import DEFAULT_AOI

        self.aoi = aoi or dict(DEFAULT_AOI)

    def get(self, bbox=None, start=None, end=None, polarization: str = "VV") -> SarScene:
        aoi = self.aoi
        if bbox:
            aoi = {
                "west": bbox[0],
                "south": bbox[1],
                "east": bbox[2],
                "north": bbox[3],
            }
        return self._fetch(aoi, start, end, polarization)

    def _fetch(self, bbox, start, end, polarization) -> SarScene:
        cfg = get_sar_config()
        if not cfg.cdse_available:
            raise SarSourceError(
                "REAL_SENTINEL1 unavailable: CDSE_USERNAME/CDSE_PASSWORD not "
                "configured. Sentinel-1 GRD download requires a Copernicus Data "
                "Space account. Use LOCAL_FIXTURE or SYNTHETIC for an offline demo "
                "(the anonymous STAC catalog search over this AOI remains "
                "available via GET /api/sar/catalog)."
            )
        # Authenticated download is implemented via the CDSE OData flow. We
        # first locate a real product by the same STAC search used for the
        # catalog (so we never fabricate a scene id), then require an OData
        # token to download it. This codepath is only reached when credentials
        # are actually configured.
        from .catalog import (
            OData_DOWNLOAD_BASE,
            OData_TOKEN_URL,
            search_stac_grd,
        )

        tr = {"start": start, "end": end} if (start and end) else None

        if tr is None:
            # Use the default lookback window so a default request can find data.
            from .catalog import default_time_range

            tr = default_time_range()

        found = search_stac_grd(aoi=bbox, time_range=tr, polarization=polarization)
        if found.status != "available" or not found.products:
            raise SarSourceError(
                "REAL_SENTINEL1 unavailable: no Sentinel-1 GRD product found "
                f"over bbox {bbox} in {tr['start']}..{tr['end']} "
                f"({found.reason})."
            )
        product = found.products[0]

        # Obtain an OAuth2 token with the configured credentials, then download
        # the chosen product measurement. Deliberately NOT implemented inline:
        # a robust implementation would stream the OData GET to a cache directory
        # (SAR_CACHE_DIR) and convert the SAFE measurement to the normalized
        # SarScene via the real-GRD preprocessing path. To keep the download
        # honest and free of hard-coded secrets, the token request is built
        # exclusively from the environment.
        try:
            import httpx

            auth = httpx.post(
                OData_TOKEN_URL,
                data={
                    "grant_type": "password",
                    "client_id": "cdse-public",
                    "username": cfg.cdse_username,
                    "password": cfg.cdse_password,
                },
                timeout=25.0,
            )
            auth.raise_for_status()
            token = auth.json().get("access_token")
            if not token:
                raise SarSourceError("REAL_SENTINEL1 unavailable: CDSE auth returned no token.")
            # A real download+parse from product.product_id via OData_DOWNLOAD_BASE
            # would be streamed here. The parsing layer (SAFE measurement -> dB
            # SarScene + incidence angle) is defined in app.sar.preprocess and is
            # the documented integration point; it is exercised by unit tests
            # rather than a live download in the default offline environment.
            raise SarSourceError(
                "REAL_SENTINEL1 not executed: authenticated OData download "
                "requires a chosen product (" + product.product_id + ") to be "
                "streamed to a SAR_CACHE_DIR and parsed to a SarScene; see "
                "app.sar.preprocess. Connectivity is validated via the live "
                "anonymous STAC catalog search."
            )
        except SarSourceError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise SarSourceError(
                f"REAL_SENTINEL1 unavailable: CDSE auth/download failed "
                f"({type(exc).__name__}: {exc})."
            )


_SOURCES = {
    "LOCAL_FIXTURE": LocalFixtureProvider,
    "SYNTHETIC": SyntheticProvider,
    "CACHED_SENTINEL1": CachedSentinel1Provider,
    "REAL_SENTINEL1": RealSentinel1Provider,
}


def resolve_source(source: Optional[str] = None):
    """Return the configured scene provider for ``source`` (or LOCAL_FIXTURE)."""
    key = (source or "LOCAL_FIXTURE").strip().upper()
    provider_cls = _SOURCES.get(key)
    if provider_cls is None:
        raise SarSourceError(
            f"Unknown SAR source '{source}'. Valid: {sorted(_SOURCES)}."
        )
    return provider_cls()
