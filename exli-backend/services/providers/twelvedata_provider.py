"""
TwelveData API provider implementation.
Primary data source for stocks, ETFs, and forex data.
"""
import os
from datetime import date, datetime
from typing import List, Optional
import requests
from config import logger

from .market_data_provider import (
    MarketDataProvider,
    PriceData,
    QuoteData,
    SearchResult,
    ForexRate,
    ProviderError,
    ProviderNotFoundError,
    ProviderRateLimitError,
)

# TwelveData error codes that mean "this symbol/pair will never work", as opposed
# to a transient problem. Includes both genuinely invalid symbols and symbols
# that exist but require a higher-tier plan than this API key has - both are
# permanent for this key, so they're treated the same way (see ProviderNotFoundError).
_NOT_FOUND_CODES = {404}
_RATE_LIMIT_CODES = {429}


class TwelveDataProvider(MarketDataProvider):
    """
    TwelveData API implementation.
    
    Features:
    - Stocks and ETFs from global exchanges
    - Forex pairs with historical data
    - Rate limiting handled internally
    
    API Docs: https://twelvedata.com/docs
    """
    
    BASE_URL = "https://api.twelvedata.com"
    
    def __init__(self, api_key: str = None):
        self._api_key = api_key or os.environ.get("TWELVEDATA_API_KEY")
        if not self._api_key:
            logger.warning("TwelveData API key not configured")
    
    @property
    def name(self) -> str:
        return "TwelveData"
    
    def is_available(self) -> bool:
        return bool(self._api_key)
    
    def _make_request(self, endpoint: str, params: dict) -> dict:
        """Make authenticated request to TwelveData API.

        Raises ProviderNotFoundError or ProviderRateLimitError for those specific,
        classified failures (see market_data_provider.py), or ProviderError for
        anything else, instead of swallowing failures to None - callers used to
        have no way to tell "this symbol is dead" apart from "the provider is
        rate-limited", which let a handful of permanently-404ing tickers trip
        the ingestion breaker every night (see docs/fx/01-fx-plan.md §0.1).

        IMPORTANT: never build a log message or exception from the raw
        requests exception/URL here - it contains apikey= in the query string.
        Only the parsed JSON error body (code/message) is ever surfaced.
        """
        params["apikey"] = self._api_key
        try:
            response = requests.get(f"{self.BASE_URL}/{endpoint}", params=params, timeout=30)
        except requests.RequestException as e:
            raise ProviderError(f"TwelveData request failed: {type(e).__name__}") from None

        try:
            data = response.json()
        except ValueError:
            data = None

        error_code = None
        error_message = None
        if isinstance(data, dict) and data.get("status") == "error":
            error_code = data.get("code")
            error_message = data.get("message", "Unknown error")
        elif not response.ok:
            error_code = response.status_code
            error_message = f"HTTP {response.status_code}"
        elif not isinstance(data, dict):
            # 2xx with a body that isn't a JSON object (or isn't JSON at all) -
            # not classifiable as not-found/rate-limited, but still a failure.
            error_code = "unparseable_response"
            error_message = "Response was not a JSON object"

        if error_code is not None:
            if error_code in _RATE_LIMIT_CODES or "credit" in (error_message or "").lower():
                raise ProviderRateLimitError(error_message)
            if error_code in _NOT_FOUND_CODES:
                raise ProviderNotFoundError(error_message)
            raise ProviderError(f"TwelveData API error {error_code}: {error_message}")

        return data
    
    def get_time_series(
        self, 
        symbol: str, 
        start_date: date, 
        end_date: date, 
        interval: str = "1day"
    ) -> List[PriceData]:
        """Fetch historical OHLCV data"""
        params = {
            "symbol": symbol,
            "interval": interval,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "outputsize": 5000,  # Max allowed
            "format": "JSON"
        }
        
        # Raises ProviderNotFoundError/ProviderRateLimitError/ProviderError on
        # failure - callers decide how to react (see docs/fx/01-fx-plan.md §0.1).
        data = self._make_request("time_series", params)
        if "values" not in data:
            logger.warning(f"TwelveData returned no 'values' for {symbol}")
            return []

        result = []
        for item in data["values"]:
            try:
                result.append(PriceData(
                    date=item["datetime"],
                    open=float(item["open"]),
                    high=float(item["high"]),
                    low=float(item["low"]),
                    close=float(item["close"]),
                    volume=int(item.get("volume", 0)) if item.get("volume") else None
                ))
            except (KeyError, ValueError) as e:
                logger.warning(f"Skipping malformed data point for {symbol}: {e}")
                continue
        
        # TwelveData returns newest first, reverse for chronological order
        return list(reversed(result))
    
    def get_forex_rates(
        self, 
        base_currency: str, 
        quote_currency: str, 
        start_date: date, 
        end_date: date
    ) -> List[ForexRate]:
        """Fetch historical forex rates"""
        symbol = f"{base_currency}/{quote_currency}"
        params = {
            "symbol": symbol,
            "interval": "1day",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "outputsize": 5000,
            "format": "JSON"
        }
        
        data = self._make_request("time_series", params)
        if "values" not in data:
            logger.warning(f"TwelveData returned no 'values' for {symbol}")
            return []
        
        result = []
        for item in data["values"]:
            try:
                result.append(ForexRate(
                    date=item["datetime"],
                    open=float(item["open"]),
                    high=float(item["high"]),
                    low=float(item["low"]),
                    close=float(item["close"])
                ))
            except (KeyError, ValueError) as e:
                logger.warning(f"Skipping malformed forex data for {symbol}: {e}")
                continue
        
        return list(reversed(result))
    
    def search_symbol(self, query: str, limit: int = 10) -> List[SearchResult]:
        """Search for symbols"""
        params = {
            "symbol": query,
            "outputsize": limit
        }
        
        data = self._make_request("symbol_search", params)
        if "data" not in data:
            return []
        
        results = []
        for item in data["data"][:limit]:
            try:
                results.append(SearchResult(
                    symbol=item["symbol"],
                    name=item.get("instrument_name", item["symbol"]),
                    type=item.get("instrument_type", "stock").lower(),
                    exchange=item.get("exchange", ""),
                    currency=item.get("currency", "USD")
                ))
            except KeyError:
                continue
        
        return results
    
    def get_quote(self, symbol: str) -> Optional[QuoteData]:
        """Get current quote for a symbol. This is supplementary metadata (name,
        exchange, current price) on top of get_time_series()'s history, so unlike
        that method it swallows provider errors to None rather than raising -
        a quote failing shouldn't block ingesting the symbol's price history."""
        params = {"symbol": symbol}

        try:
            data = self._make_request("quote", params)
        except ProviderError as e:
            logger.warning(f"Quote unavailable for {symbol}: {e}")
            return None

        if "symbol" not in data:
            return None

        try:
            return QuoteData(
                symbol=data["symbol"],
                name=data.get("name", data["symbol"]),
                price=float(data.get("close", 0)),
                change=float(data.get("change", 0)),
                change_percent=float(data.get("percent_change", 0)),
                currency=data.get("currency", "USD"),
                exchange=data.get("exchange", ""),
                timestamp=data.get("datetime", datetime.now().isoformat())
            )
        except (KeyError, ValueError) as e:
            logger.error(f"Failed to parse quote for {symbol}: {e}")
            return None

    def get_forex_quote(self, base_currency: str, quote_currency: str) -> Optional[float]:
        """Get current forex rate. Supplementary, same reasoning as get_quote()."""
        symbol = f"{base_currency}/{quote_currency}"
        params = {"symbol": symbol}

        try:
            data = self._make_request("exchange_rate", params)
        except ProviderError as e:
            logger.warning(f"Exchange rate unavailable for {symbol}: {e}")
            return None

        if "rate" not in data:
            return None

        try:
            return float(data["rate"])
        except ValueError:
            return None
    
    def get_stocks_list(self, exchange: str = None, type_filter: str = None) -> List[dict]:
        """
        Get list of available stocks/ETFs.
        
        Args:
            exchange: Filter by exchange (e.g., "NASDAQ", "NYSE")
            type_filter: Filter by type (e.g., "stock", "etf")
        """
        params = {}
        if exchange:
            params["exchange"] = exchange
        if type_filter:
            params["type"] = type_filter
        
        data = self._make_request("stocks", params)
        if "data" not in data:
            return []
        
        return data["data"]
