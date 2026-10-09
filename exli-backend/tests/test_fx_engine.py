"""
Tests for services/fx_engine.py, run against the shared fixtures in
docs/fx/fx-test-vectors.json - the same file exli-front's
scripts/verify-fx-vectors.mjs checks the JS mirror against, so the two
implementations can't silently drift apart (same pattern as Groups'
split_engine.py / splitEngine.js).
"""
import json
import math
import os

import pytest

from services.fx_engine import FxError, convert

VECTORS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "docs", "fx", "fx-test-vectors.json"
)


def _load_vectors():
    with open(VECTORS_PATH, encoding="utf-8") as f:
        return json.load(f)


DATA = _load_vectors()


def _assert_close(actual, expected, msg):
    if expected is None:
        assert actual is None, msg
    else:
        assert actual is not None, msg
        assert math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-9), msg


class TestSharedVectors:
    @pytest.mark.parametrize("vector", DATA["vectors"], ids=[v["description"] for v in DATA["vectors"]])
    def test_vector(self, vector):
        table = vector.get("table", DATA["table"])
        result = convert(vector["input"], table)
        expected = vector["expected"]

        _assert_close(result["value"], expected["value"], f"value mismatch: {vector['description']}")
        _assert_close(result["rate"], expected["rate"], f"rate mismatch: {vector['description']}")
        assert result["rateDate"] == expected["rateDate"], f"rateDate mismatch: {vector['description']}"
        assert result["basis"] == expected["basis"], f"basis mismatch: {vector['description']}"
        assert result["approximate"] == expected["approximate"], f"approximate mismatch: {vector['description']}"
        assert result.get("reason") == expected.get("reason"), f"reason mismatch: {vector['description']}"

    @pytest.mark.parametrize("vector", DATA["errorVectors"], ids=[v["description"] for v in DATA["errorVectors"]])
    def test_error_vector(self, vector):
        with pytest.raises(FxError):
            convert(vector["input"], DATA["table"])


class TestEngineDirectly:
    """A few extra cases that don't need to be duplicated across languages."""

    def test_none_table_treated_as_empty(self):
        result = convert({"amount": 10, "from": "USD", "to": "ILS", "date": "2025-08-20"}, None)
        assert result["value"] is None
        assert result["reason"] == "unsupported"

    def test_same_currency_ignores_a_completely_broken_table(self):
        result = convert({"amount": 10, "from": "USD", "to": "USD"}, {"daily": None, "monthlyAvg": None, "latest": None})
        assert result["value"] == 10

    def test_never_rounds(self):
        table = {"daily": {"2025-08-20": {"USD": 1.0, "ILS": 3.33333333}}}
        result = convert({"amount": 3, "from": "USD", "to": "ILS", "date": "2025-08-20"}, table)
        assert result["value"] == pytest.approx(9.99999999, rel=1e-9)
        # not rounded to e.g. 10.0 or 2 decimal places
        assert result["value"] != 10.0

    def test_non_numeric_amount_raises(self):
        with pytest.raises(FxError):
            convert({"amount": "100", "from": "USD", "to": "ILS"}, DATA["table"])

    def test_malformed_date_degrades_gracefully_instead_of_raising(self):
        # A full ISO datetime string (not a plain 'YYYY-MM-DD') used to raise
        # ValueError deep in the day-lookback fallback and crash the caller -
        # caught 2026-09-30 when a personal expense's raw `date` (stored as a
        # full datetime) reached this path via Analytics. Mirrors fxEngine.js's
        # equivalent shiftDate guard.
        table = {"daily": {"2025-08-20": {"USD": 1.0, "ILS": 3.4}}}
        result = convert(
            {"amount": 10, "from": "USD", "to": "ILS", "date": "2025-08-20T00:00:00.000Z"},
            table,
        )
        assert result["value"] is None
        assert result["reason"] == "unsupported"
