"""
Tests for TwelveDataProvider's error classification and API-key redaction
(docs/fx/01-fx-plan.md §0.1, §0.3).

TwelveData returns HTTP 200 for most errors, with the real error in the JSON
body's {"status": "error", "code": ..., "message": ...} - confirmed live on
2026-09-26 against real dead/plan-gated tickers (K, WBA, PXD, HES, CTRA,
PEAK). It returns a real HTTP 404 for some of those too. Either shape must
classify as ProviderNotFoundError, never as a rate limit.
"""
from unittest.mock import MagicMock, patch

import pytest
import requests

from services.providers.market_data_provider import (
    ProviderError,
    ProviderNotFoundError,
    ProviderRateLimitError,
)
from services.providers.twelvedata_provider import TwelveDataProvider

FAKE_KEY = "test-api-key-should-never-appear-in-logs"


def _make_response(status_code, json_body, ok=None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.ok = ok if ok is not None else (200 <= status_code < 300)
    resp.json.return_value = json_body
    resp.text = str(json_body)
    return resp


@pytest.fixture
def provider():
    return TwelveDataProvider(FAKE_KEY)


class TestNotFoundClassification:
    def test_json_error_code_404_raises_not_found(self, provider):
        # Real body observed for a plan-gated symbol like "K" or "PEAK".
        body = {
            "code": 404,
            "message": "This symbol is available starting with the Grow or Venture plan.",
            "status": "error",
        }
        with patch("requests.get", return_value=_make_response(404, body)):
            with pytest.raises(ProviderNotFoundError):
                provider._make_request("time_series", {"symbol": "K"})

    def test_json_error_code_404_invalid_symbol_raises_not_found(self, provider):
        # Real body observed for a genuinely delisted symbol like "WBA".
        body = {
            "code": 404,
            "message": "**symbol** or **figi** parameter is missing or invalid.",
            "status": "error",
        }
        with patch("requests.get", return_value=_make_response(404, body)):
            with pytest.raises(ProviderNotFoundError):
                provider._make_request("time_series", {"symbol": "WBA"})

    def test_bare_http_404_with_no_json_body_raises_not_found(self, provider):
        with patch("requests.get", return_value=_make_response(404, {})):
            with pytest.raises(ProviderNotFoundError):
                provider._make_request("time_series", {"symbol": "WHATEVER"})


class TestRateLimitClassification:
    def test_json_error_code_429_raises_rate_limit(self, provider):
        body = {"code": 429, "message": "You have run out of API credits for the current minute.", "status": "error"}
        with patch("requests.get", return_value=_make_response(429, body)):
            with pytest.raises(ProviderRateLimitError):
                provider._make_request("time_series", {"symbol": "AAPL"})

    def test_message_mentioning_credits_raises_rate_limit_even_without_code_429(self, provider):
        # Defensive: classify by message too, not just the numeric code, in
        # case TwelveData ever reports quota exhaustion under a different code.
        body = {"code": 400, "message": "You have run out of API credits.", "status": "error"}
        with patch("requests.get", return_value=_make_response(400, body)):
            with pytest.raises(ProviderRateLimitError):
                provider._make_request("time_series", {"symbol": "AAPL"})

    def test_dead_symbols_never_misclassify_as_rate_limited(self, provider):
        # The exact bug: 6 dead symbols in a row must not look like a rate limit.
        body = {"code": 404, "message": "invalid symbol", "status": "error"}
        for _ in range(6):
            with patch("requests.get", return_value=_make_response(404, body)):
                with pytest.raises(ProviderNotFoundError):
                    provider._make_request("time_series", {"symbol": "DEAD"})


class TestSuccessAndOtherErrors:
    def test_success_returns_parsed_json(self, provider):
        body = {"values": [{"datetime": "2025-08-20", "open": "1", "high": "1", "low": "1", "close": "1"}]}
        with patch("requests.get", return_value=_make_response(200, body)):
            result = provider._make_request("time_series", {"symbol": "AAPL"})
        assert result == body

    def test_unclassified_error_code_raises_generic_provider_error(self, provider):
        body = {"code": 500, "message": "Internal error", "status": "error"}
        with patch("requests.get", return_value=_make_response(500, body)):
            with pytest.raises(ProviderError):
                provider._make_request("time_series", {"symbol": "AAPL"})

    def test_network_failure_raises_provider_error(self, provider):
        with patch("requests.get", side_effect=requests.ConnectionError("boom")):
            with pytest.raises(ProviderError):
                provider._make_request("time_series", {"symbol": "AAPL"})


class TestApiKeyNeverLeaks:
    """The bug that shipped alongside the breaker fix: exceptions built from
    the raw requests error/URL include apikey=... in the query string, and
    that string ends up in Cloud Run logs verbatim. Every failure path here
    must produce a message that never contains the key."""

    def test_network_error_message_has_no_api_key(self, provider):
        with patch("requests.get", side_effect=requests.ConnectionError(f"connect failed for url with apikey={FAKE_KEY}")):
            with pytest.raises(ProviderError) as excinfo:
                provider._make_request("time_series", {"symbol": "AAPL"})
        assert FAKE_KEY not in str(excinfo.value)

    def test_http_error_message_has_no_api_key(self, provider):
        resp = _make_response(404, {"code": 404, "message": "invalid symbol", "status": "error"})
        with patch("requests.get", return_value=resp):
            with pytest.raises(ProviderNotFoundError) as excinfo:
                provider._make_request("time_series", {"symbol": "AAPL"})
        assert FAKE_KEY not in str(excinfo.value)

    def test_generic_error_message_has_no_api_key(self, provider):
        resp = _make_response(500, {"code": 500, "message": "boom", "status": "error"})
        with patch("requests.get", return_value=resp):
            with pytest.raises(ProviderError) as excinfo:
                provider._make_request("time_series", {"symbol": "AAPL"})
        assert FAKE_KEY not in str(excinfo.value)


class TestSupplementaryCallsSwallowErrors:
    """get_quote/get_forex_quote are supplementary metadata on top of
    get_time_series()'s history - their failure must not raise, so a quote
    hiccup never blocks ingesting the symbol's price history."""

    def test_get_quote_returns_none_on_not_found(self, provider):
        body = {"code": 404, "message": "invalid symbol", "status": "error"}
        with patch("requests.get", return_value=_make_response(404, body)):
            assert provider.get_quote("DEAD") is None

    def test_get_forex_quote_returns_none_on_rate_limit(self, provider):
        body = {"code": 429, "message": "out of credits", "status": "error"}
        with patch("requests.get", return_value=_make_response(429, body)):
            assert provider.get_forex_quote("USD", "ILS") is None


class TestHistoricalCallsRaise:
    """Unlike get_quote/get_forex_quote, get_time_series/get_forex_rates must
    propagate the classified exception so the ingestion loop can tombstone
    dead symbols and react to real rate limits."""

    def test_get_time_series_raises_not_found(self, provider):
        body = {"code": 404, "message": "invalid symbol", "status": "error"}
        with patch("requests.get", return_value=_make_response(404, body)):
            with pytest.raises(ProviderNotFoundError):
                provider.get_time_series("DEAD", __import__("datetime").date(2025, 1, 1), __import__("datetime").date(2025, 1, 2))

    def test_get_forex_rates_raises_rate_limit(self, provider):
        body = {"code": 429, "message": "out of credits", "status": "error"}
        with patch("requests.get", return_value=_make_response(429, body)):
            with pytest.raises(ProviderRateLimitError):
                provider.get_forex_rates("USD", "ILS", __import__("datetime").date(2025, 1, 1), __import__("datetime").date(2025, 1, 2))
