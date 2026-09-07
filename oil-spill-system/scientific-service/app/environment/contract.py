"""Normalized environmental forcing contract.

The scientific engine must not care whether forcing comes from CMEMS, ERA5,
a controlled test field, or a future alternative. This module defines the
normalized representation every provider produces and the OpenOil drift
engine consumes.

Only u/v (eastward/northward) velocity components are used for advection.
Components are in metres per second (m/s).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass(frozen=True)
class EnvironmentSample:
    """A single horizontally-uniform forcing sample valid for one time step.

    For a region the engine evaluates the point at the spill origin; the
    providers yield the value representative of that location. Spatial grids
    are deliberately out of scope for the MVP.
    """

    timestamp: datetime
    latitude: float
    longitude: float
    # Eastward / northward ocean current velocity (m/s)
    u_current: float
    v_current: float
    # Eastward / northward 10 m wind velocity (m/s)
    u_wind: float
    v_wind: float
    # Provenance: which provider produced this sample.
    source: str
    dataset: str
    resolution_degrees: Optional[float] = None


@dataclass
class EnvironmentField:
    """A time series of normalized forcing samples for a drift run."""

    samples: List[EnvironmentSample] = field(default_factory=list)

    def append(self, sample: EnvironmentSample) -> None:
        self.samples.append(sample)

    @property
    def source(self) -> str:
        if not self.samples:
            return "none"
        return self.samples[0].source

    @property
    def dataset(self) -> str:
        if not self.samples:
            return "none"
        return self.samples[0].dataset


class EnvironmentProviderError(RuntimeError):
    """Raised when an environment provider cannot satisfy a request."""


class EnvironmentProvider:
    """Base class. Subclasses produce a normalized EnvironmentField.

    A provider is characterised by a `source` slug (e.g. ``CONTROLLED``,
    ``CMEMS``, ``ERA5``) and a `dataset` name used for provenance.
    """

    source: str = "unknown"
    dataset: str = "unknown"

    def get(
        self,
        latitude: float,
        longitude: float,
        start_time: datetime,
        duration_hours: float,
        time_step_seconds: int,
    ) -> EnvironmentField:
        """Return normalized forcing from `start_time` for `duration_hours`.

        Subclasses must implement this. `time_step_seconds` determines the
        number of samples (matching OpenDrift's integration step).
        """
        raise NotImplementedError