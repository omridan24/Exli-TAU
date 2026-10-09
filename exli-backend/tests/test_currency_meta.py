"""Tests for services/currency_meta.py, plus a cross-check that CURRENCY_META
actually covers every currency the FX ingestion pipeline tracks - a mismatch
here would mean the picker/display can't show something FX has real rates
for, or vice versa."""
from services.currency_meta import (
    CURRENCY_META,
    get_meta,
    get_minor_units,
    round_to_minor_units,
    supported_currencies,
)
from services.fx_ingest_service import usd_pivot_currencies
from services.symbol_lists import CURRENCY_PAIRS


class TestMinorUnits:
    def test_known_zero_decimal_currencies(self):
        for code in ("JPY", "KRW", "VND", "CLP"):
            assert get_minor_units(code) == 0, code

    def test_known_three_decimal_currencies(self):
        for code in ("BHD", "JOD", "KWD", "OMR"):
            assert get_minor_units(code) == 3, code

    def test_default_two_decimals(self):
        assert get_minor_units("USD") == 2
        assert get_minor_units("ILS") == 2

    def test_unknown_currency_falls_back_to_two_not_a_crash(self):
        assert get_minor_units("XYZ") == 2


class TestRounding:
    def test_rounds_jpy_to_whole_units(self):
        assert round_to_minor_units(123.456, "JPY") == 123

    def test_rounds_ils_to_two_decimals(self):
        assert round_to_minor_units(123.456, "ILS") == 123.46

    def test_rounds_kwd_to_three_decimals(self):
        assert round_to_minor_units(1.23456, "KWD") == 1.235


class TestMetaLookup:
    def test_get_meta_returns_full_entry(self):
        meta = get_meta("EUR")
        assert meta["symbol"] == "€"
        assert meta["nameEn"] == "Euro"

    def test_get_meta_unknown_returns_none(self):
        assert get_meta("XYZ") is None

    def test_every_entry_has_required_fields(self):
        for code, meta in CURRENCY_META.items():
            for field in ("symbol", "minorUnits", "nameEn", "nameHe", "flag"):
                assert field in meta, f"{code} missing {field}"
            assert isinstance(meta["minorUnits"], int)

    def test_supported_currencies_is_sorted(self):
        codes = supported_currencies()
        assert codes == sorted(codes)


class TestCoversWhatFxActuallyTracks:
    def test_every_fx_tracked_currency_has_display_metadata(self):
        tracked = set(usd_pivot_currencies(CURRENCY_PAIRS))
        missing = tracked - set(CURRENCY_META.keys())
        assert not missing, f"CURRENCY_META is missing display data for: {missing}"
