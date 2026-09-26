"""
Abstract base class for market data providers.
This defines the interface that all providers (TwelveData, Yahoo, etc.) must implement.
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import date
from dataclasses import dataclass


class ProviderError(Exception):
    """A market-data provider request failed. Base class for the typed errors
    below; catch this to handle "something went wrong" without caring which.

    Messages on all of these are built from the provider's own error body,
    never from the failed request itself, so they never contain the API key -
    see the note on TwelveDataProvider._make_request().
    """


class ProviderNotFoundError(ProviderError):
    """The symbol/pair does not exist, is invalid, or isn't available on the
    account's current plan tier. This is a PERMANENT condition for that
    symbol - it will never succeed on retry - so callers should treat it very
    differently from a rate limit: don't count it as a sign the provider is
    struggling, and don't keep retrying it every run.
    """


class ProviderRateLimitError(ProviderError):
    """The provider is throttling or has run out of credits. This is a
    TRANSIENT, account-wide condition - unlike ProviderNotFoundError, it says
    nothing about the specific symbol, and the caller should back off.
    """


@dataclass
class PriceData:
    """Standardized price data point"""
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[int] = None


@dataclass
class QuoteData:
    """Current quote data for a symbol"""
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    currency: str
    exchange: str
    timestamp: str


@dataclass
class SearchResult:
    """Search result for symbol lookup"""
    symbol: str
    name: str
    type: str  # stock, etf, forex, crypto
    exchange: str
    currency: str


@dataclass
class ForexRate:
    """Forex exchange rate data point"""
    date: str
    open: float
    high: float
    low: float
    close: float


class MarketDataProvider(ABC):
    """
    Abstract interface for market data providers.
    
    Implementations:
    - TwelveDataProvider: Primary provider using TwelveData API
    - YahooProvider: Fallback using yfinance
    
    This allows swapping providers without changing the rest of the codebase.
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging/identification"""
        pass
    
    @abstractmethod
    def get_time_series(
        self, 
        symbol: str, 
        start_date: date, 
        end_date: date, 
        interval: str = "1day"
    ) -> List[PriceData]:
        """
        Fetch historical OHLCV data for a symbol.
        
        Args:
            symbol: Stock/ETF ticker (e.g., "AAPL", "SPY")
            start_date: Start of date range
            end_date: End of date range
            interval: Data interval ("1day", "1week", "1month")
            
        Returns:
            List of PriceData objects sorted by date ascending
        """
        pass
    
    @abstractmethod
    def get_forex_rates(
        self, 
        base_currency: str, 
        quote_currency: str, 
        start_date: date, 
        end_date: date
    ) -> List[ForexRate]:
        """
        Fetch historical forex exchange rates.
        
        Args:
            base_currency: Base currency code (e.g., "USD")
            quote_currency: Quote currency code (e.g., "ILS")
            start_date: Start of date range
            end_date: End of date range
            
        Returns:
            List of ForexRate objects sorted by date ascending
        """
        pass
    
    @abstractmethod
    def search_symbol(self, query: str, limit: int = 10) -> List[SearchResult]:
        """
        Search for symbols matching a query.
        
        Args:
            query: Search string (symbol or company name)
            limit: Maximum results to return
            
        Returns:
            List of SearchResult objects
        """
        pass
    
    @abstractmethod
    def get_quote(self, symbol: str) -> Optional[QuoteData]:
        """
        Get current price quote for a symbol.
        
        Args:
            symbol: Stock/ETF ticker
            
        Returns:
            QuoteData or None if not found
        """
        pass
    
    @abstractmethod
    def get_forex_quote(self, base_currency: str, quote_currency: str) -> Optional[float]:
        """
        Get current forex exchange rate.
        
        Args:
            base_currency: Base currency code
            quote_currency: Quote currency code
            
        Returns:
            Current exchange rate or None
        """
        pass
    
    def is_available(self) -> bool:
        """
        Check if the provider is available/configured.
        Override to add validation logic.
        """
        return True
