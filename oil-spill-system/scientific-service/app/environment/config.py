"""Environment configuration.

Reads any external-service credentials from the process environment (or a
`.env` file) rather than hard-coding them. Providers report AVAILABLE /
UNAVAILABLE based on what the operator has actually configured.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class EnvironmentConfig:
    """Configuration that determines which real-data providers can run.

    Every external-service credential lives here and is read from the
    environment. If a credential is missing the corresponding provider is
    reported UNAVAILABLE and the caller must fall back to CONTROLLED forcing.
    """

    # Copernicus Marine Service (CMEMS).
    cmems_username: str = field(default_factory=lambda: os.getenv("CMEMS_USERNAME", ""))
    cmems_password: str = field(default_factory=lambda: os.getenv("CMEMS_PASSWORD", ""))
    cmems_dataset_id: str = field(
        default_factory=lambda: os.getenv(
            "CMEMS_DATASET_ID", "cmems_mod_glo_phy_my_0.083deg_P1D-m"
        )
    )

    # Copernicus Climate Data Store (ERA5 wind).
    # Primary key names match the repo `.env` template (CDS_API_URL/CDS_API_KEY).
    # `CDS_URL`/`CDS_KEY` are accepted as backwards-compatible aliases.
    cds_url: str = field(
        default_factory=lambda: os.getenv("CDS_API_URL")
        or os.getenv("CDS_URL")
        or "https://cds.climate.copernicus.eu/api"
    )
    cds_key: str = field(
        default_factory=lambda: os.getenv("CDS_API_KEY") or os.getenv("CDS_KEY", "")
    )

    @property
    def cmems_available(self) -> bool:
        return bool(self.cmems_username and self.cmems_password)

    @property
    def era5_available(self) -> bool:
        return bool(self.cds_key)


@lru_cache(maxsize=1)
def get_environment_config() -> EnvironmentConfig:
    """Read the effective environment configuration once per process."""
    return EnvironmentConfig()


def report_environment_availability() -> dict:
    """Human/API-facing report of which real data providers can run."""
    cfg = get_environment_config()
    return {
        "environment": {
            "controlled": {"status": "AVAILABLE", "note": "Deterministic constant forcing (synthetic)."},
            "cmems": {
                "status": "AVAILABLE" if cfg.cmems_available else "UNAVAILABLE",
                "note": "Credentials configured." if cfg.cmems_available
                else "Missing CMEMS_USERNAME/CMEMS_PASSWORD (or no network).",
                "dataset_id": cfg.cmems_dataset_id,
            },
            "era5": {
                "status": "AVAILABLE" if cfg.era5_available else "UNAVAILABLE",
                "note": "CDS_API_KEY configured." if cfg.era5_available
                else "Missing CDS_KEY (ERA5 API token) or no network.",
            },
            "openmeteo": {
                "status": "AVAILABLE",
                "note": "Open-Meteo forecast + marine (live, no credentials).",
            },
        }
    }