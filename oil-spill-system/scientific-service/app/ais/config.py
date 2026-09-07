"""AIS provider configuration.

Mirrors ``app.environment.config``: reads external-service credentials from the
environment / ``.env`` so the availability report reflects what the operator
has *actually* configured. Simulated traffic (Layer A) is always available;
real feeds (Layer B) report AVAILABLE only when they can genuinely run.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()

#: Reference epoch anchoring the deterministic traffic world. Vessel motion is
#: a pure function of elapsed time from this instant for a given seed, so a
#: query window anywhere in time uses the same reproducible fleet.
CONTROLLED_AIS_REFERENCE_TIME = datetime(2026, 8, 1, 0, 0, 0, tzinfo=timezone.utc)

#: Default generator seed for the demo investigation. A fixed seed makes the
#: simulated fleet reproducible across runs (see STEP_10_REPORT).
DEFAULT_CONTROLLED_SEED = 26143


@dataclass(frozen=True)
class AisConfig:
    """Configuration that determines which real AIS providers can run."""

    # Global Fishing Watch API key (free non-commercial licence).
    gfw_api_key: str = field(default_factory=lambda: os.getenv("GFW_API_KEY", ""))

    # Real-time feed token (aisstream.io) — real-time only, not historical.
    aisstream_token: str = field(default_factory=lambda: os.getenv("AISSTREAM_TOKEN", ""))

    @property
    def gfw_available(self) -> bool:
        return bool(self.gfw_api_key)


@lru_cache(maxsize=1)
def get_ais_config() -> AisConfig:
    """Read the effective AIS configuration once per process."""
    return AisConfig()


def report_ais_availability() -> dict:
    """Human/API-facing report of which AIS data sources can run.

    ``state`` uses the four-way provenance vocabulary the whole product shares
    (REAL / CONTROLLED / FIXTURE / UNAVAILABLE).
    """
    cfg = get_ais_config()
    return {
        "ais": {
            "controlled": {
                "status": "AVAILABLE",
                "state": "CONTROLLED",
                "note": "Deterministic seeded simulated AIS traffic (Layer A). Never presented as real AIS.",
                "dataset": "controlled-ais-v1",
                "seed": DEFAULT_CONTROLLED_SEED,
            },
            "gfw": {
                "status": "AVAILABLE" if cfg.gfw_available else "UNAVAILABLE",
                "state": "UNAVAILABLE",
                "note": (
                    "Free non-commercial Global Fishing Watch historical AIS is a documented "
                    "integration seam (GFW_API_KEY) but is not wired to verified endpoints in this "
                    "build — an unverified client would risk mislabelling data, so this provider "
                    "only reports availability and refuses to fabricate results. See STEP_10_REPORT."
                    if cfg.gfw_available
                    else "Missing GFW_API_KEY (free non-commercial key via globalfishingwatch.org/our-apis/)."
                ),
            },
            "marine_cadastre": {
                "status": "UNAVAILABLE",
                "state": "UNAVAILABLE",
                "note": "US National Marine Cadastre AIS covers US waters only; not applicable to the Indian Ocean demonstration AOI.",
            },
            "aisstream": {
                "status": "UNAVAILABLE",
                "state": "UNAVAILABLE",
                "note": "aisstream.io is a real-time WebSocket feed with no historical archive; the attribution window is historical.",
            },
        }
    }