"""AIS providers.

Layer A  -> ControlledAisProvider (deterministic, seeded simulated traffic).
Layer B  -> GfwAisProvider / MarineCadastreProvider / AisStreamProvider (real
            data seams; each is honest about being UNAVAILABLE rather than
            fabricating a real feed).

The provenance contract (contract.AisSourceState) is strictly enforced:

* a CONTROLLED track is stamped ``CONTROLLED`` and never presented as real;
* a Layer B provider that cannot serve the requested window/region raises
  :class:`AisProviderError` with an explicit reason and returns NOTHING — it
  must never substitute simulated data for a real feed it could not obtain.

Availability is reported per source via ``report_ais_availability`` so the UI
and API surface show exactly which feeds can run.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .config import (
    CONTROLLED_AIS_REFERENCE_TIME,
    DEFAULT_CONTROLLED_SEED,
    get_ais_config,
)
from .contract import (
    AisProvider,
    AisProviderError,
    AisSourceState,
    AisTrack,
)
from .generator import (
    build_track,
    focus_tracks,
    generate_fleet,
)


class ControlledAisProvider(AisProvider):
    """Layer A: deterministic seeded simulated AIS traffic (CONTROLLED).

    The same generator the validation scenarios use; ground truth never enters
    this path. Reproducible per seed via :data:`DEFAULT_CONTROLLED_SEED` or an
    explicit ``seed`` argument. See generator.py for the lane/vessel model.
    """

    source = "CONTROLLED"
    state = AisSourceState.CONTROLLED
    dataset = "controlled-ais-v1"
    is_available = True

    def __init__(self, seed: int | None = DEFAULT_CONTROLLED_SEED) -> None:
        self.seed = seed
        self.reference_time = CONTROLLED_AIS_REFERENCE_TIME

    def query(
        self,
        *,
        center_lon: float,
        center_lat: float,
        time_start: datetime,
        time_end: datetime,
        radius_km: float,
        seed: int | None = None,
        max_vessels: int | None = None,
    ) -> list[AisTrack]:
        if time_end <= time_start:
            raise AisProviderError("time_end must be after time_start")
        eff_seed = self.seed if seed is None else seed
        fleet = generate_fleet(seed=eff_seed, reference_time=self.reference_time)

        # A little padding so a vessel still inside radius at the window edges
        # is represented; filtering stage applies the strict window anyway.
        pad = timedelta(minutes=20)
        tracks = [
            build_track(v, self.reference_time, time_start - pad, time_end + pad, seed=eff_seed)
            for v in fleet
        ]
        return focus_tracks(
            tracks,
            center_lon,
            center_lat,
            radius_km,
            time_start,
            time_end,
            max_tracks=max_vessels,
        )


class GfwAisProvider(AisProvider):
    """Global Fishing Watch historical AIS (Layer B, real-data seam).

    GFW offers a free non-commercial API (globalfishingwatch.org/our-apis/):
    the Vessel identity API (🛃 requires API key) and the 4Wings "public
    global presence" tiles expose hourly presence grids (2012 → ~96 h ago). No
    sub-hourly pricing-free historical position API is available for the
    Indian Ocean demonstration AOI.

    This build deliberately does NOT attempt an unverified HTTP integration:
    an unverified client would risk mislabelling or silently failing.
    ``query`` therefore raises with an explicit reason whenever the real feed
    is not genuinely available, and this provider never returns fabricated
    traffic in place of a real feed.

    Integration pre-requisites (documented in STEP_10_REPORT §4): obtain the
    free key, verify the 4Wings tiles for the window/bbox, then implement
    presence-grid decoding here with a small feature flag.
    """

    source = "GFW"
    state = AisSourceState.UNAVAILABLE
    dataset = "gfw-4wings-presence"
    is_available = False

    def query(
        self,
        *,
        center_lon: float,
        center_lat: float,
        time_start: datetime,
        time_end: datetime,
        radius_km: float,
        seed: int | None = None,
        max_vessels: int | None = None,
    ) -> list[AisTrack]:
        cfg = get_ais_config()
        if not cfg.gfw_available:
            raise AisProviderError(
                "GFW UNAVAILABLE: GFW_API_KEY not configured. "
                "The public demo works with the CONTROLLED (simulated) provider."
            )
        raise AisProviderError(
            "GFW UNAVAILABLE: the GFW historical-AIS client is a documented "
            "integration seam but is not yet wired to verified endpoints in "
            "this build. To avoid mislabelling data, this provider refuses to "
            "return simulated sea traffic as REAL. See STEP_10_REPORT §4."
        )


class MarineCadastreProvider(AisProvider):
    """US Marine Cadastre AIS (Layer B, real-data seam, US waters only)."""

    source = "MARINE_CADASTRE"
    state = AisSourceState.UNAVAILABLE
    dataset = "marine-cadastre-ais"
    is_available = False

    def query(
        self,
        *,
        center_lon: float,
        center_lat: float,
        time_start: datetime,
        time_end: datetime,
        radius_km: float,
        seed: int | None = None,
        max_vessels: int | None = None,
    ) -> list[AisTrack]:
        raise AisProviderError(
            "MARINE_CADASTRE UNAVAILABLE: the Marine Cadastre Hub dataset covers "
            "US coastal waters only and cannot serve the Indian Ocean AOI."
        )


class AisStreamProvider(AisProvider):
    """aisstream.io live feed (Layer B, real-time only)."""

    source = "AISSTREAM"
    state = AisSourceState.UNAVAILABLE
    dataset = "aisstream-live"
    is_available = False

    def query(
        self,
        *,
        center_lon: float,
        center_lat: float,
        time_start: datetime,
        time_end: datetime,
        radius_km: float,
        seed: int | None = None,
        max_vessels: int | None = None,
    ) -> list[AisTrack]:
        raise AisProviderError(
            "AISSTREAM UNAVAILABLE: aisstream.io provides a real-time WebSocket "
            "feed only; there is no historical archive to serve the attribution "
            "window. Use CONTROLLED for the historical demonstration."
        )


def resolve_ais_provider(source: str | None = None) -> AisProvider:
    """Return the provider matching ``source``; the controlled provider by default.

    Validated sources: ``CONTROLLED``, ``GFW``, ``MARINECADASTRE``, ``AISSTREAM``.
    """
    key = (source or "CONTROLLED").strip().upper().replace("-", "").replace("_", "")
    if key == "GFW":
        return GfwAisProvider()
    if key == "MARINECADASTRE":
        return MarineCadastreProvider()
    if key == "AISSTREAM":
        return AisStreamProvider()
    if key == "CONTROLLED":
        return ControlledAisProvider()
    raise AisProviderError(
        f"Unknown AIS source '{source}'. Valid sources: "
        "CONTROLLED, GFW, MARINECADASTRE, AISSTREAM."
    )