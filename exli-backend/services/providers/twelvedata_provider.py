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
    ForexRate
)


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
    
    def _make_request(self, endpoint: str, params: dict) -> Optional[dict]:
        """Make authenticated request to TwelveData API"""
        params["apikey"] = self._api_key
        try:
            response = requests.get(f"{self.BASE_URL}/{endpoint}", params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            # Check for API error
            if "status" in data and data["status"] == "error":
                logger.error(f"TwelveData API error: {data.get('message', 'Unknown error')}")
                return None
                
            return data
        except requests.RequestException as e:
            logger.error(f"TwelveData request failed: {e}")
            return None
    
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
        
        data = self._make_request("time_series", params)
        if not data or "values" not in data:
            logger.warning(f"No time series data for {symbol}")
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
        if not data or "values" not in data:
            logger.warning(f"No forex data for {symbol}")
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
        if not data or "data" not in data:
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
        """Get current quote for a symbol"""
        params = {"symbol": symbol}
        
        data = self._make_request("quote", params)
        if not data or "symbol" not in data:
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
        """Get current forex rate"""
        symbol = f"{base_currency}/{quote_currency}"
        params = {"symbol": symbol}
        
        data = self._make_request("exchange_rate", params)
        if not data or "rate" not in data:
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
        if not data or "data" not in data:
            return []
        
        return data["data"]
