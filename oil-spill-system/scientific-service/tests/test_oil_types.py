"""Validation of oil-type resolution against the installed NOAA ADIOS DB."""

from __future__ import annotations

import pytest

from app.drift.engine import (
    GENERIC_CRUDE_ALIAS,
    list_valid_oil_types,
    resolve_oil_type,
)


def test_spec_generic_crude_maps_to_valid_db_entry():
    """SYSTEM_SPEC's 'GENERIC CRUDE' is not an ADIOS entry; must map cleanly."""
    resolved = resolve_oil_type(GENERIC_CRUDE_ALIAS)
    assert resolved == "GENERIC MEDIUM CRUDE"
    assert resolved in list_valid_oil_types()


def test_known_generic_types_resolve_to_themselves():
    for t in (
        "GENERIC BUNKER C",
        "GENERIC DIESEL",
        "GENERIC HEAVY CRUDE",
        "GENERIC MEDIUM CRUDE",
        "GENERIC LIGHT CRUDE",
    ):
        assert resolve_oil_type(t) == t


def test_common_spill_codes_map_onto_adios_equivalents():
    assert resolve_oil_type("HFO") == "GENERIC BUNKER C"
    assert resolve_oil_type("IFO-380") == "GENERIC BUNKER C"
    assert resolve_oil_type("DIESEL") == "GENERIC DIESEL"
    assert resolve_oil_type("CRUDE OIL") == "GENERIC MEDIUM CRUDE"


def test_unknown_oil_type_rejected():
    with pytest.raises(ValueError):
        resolve_oil_type("NOT-A-REAL-OIL")


def test_valid_types_are_nonempty():
    valid = list_valid_oil_types()
    assert len(valid) > 100, "expected the NOAA ADIOS database to be populated"
    assert "GENERIC BUNKER C" in valid