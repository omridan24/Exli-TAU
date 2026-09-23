"""
Yahoo Finance provider implementation (fallback).
Uses the yfinance library for data retrieval.
"""
from datetime import date
from typing import List, Optional
import yfinance as yf
from config import logger

from .market_data_provider import (
    MarketDataProvider, 
    PriceData, 
    QuoteData, 
    SearchResult, 
    ForexRate
)


class YahooProvider(MarketDataProvider):
    """
    Yahoo Finance implementation using yfinance.
    
    Use as fallback when TwelveData is unavailable or rate-limited.
    Note: yfinance doesn't have great search, mainly for data retrieval.
    """
    
    @property
    def name(self) -> str:
        return "Yahoo Finance"
    
    def get_time_series(
        self, 
        symbol: str, 
        start_date: date, 
        end_date: date, 
        interval: str = "1day"
    ) -> List[PriceData]:
        """Fetch historical OHLCV data"""
        try:
            ticker = yf.Ticker(symbol)
            
            # Map interval to yfinance format
            interval_map = {
                "1day": "1d",
                "1week": "1wk",
                "1month": "1mo"
            }
            yf_interval = interval_map.get(interval, "1d")
            
            hist = ticker.history(
                start=start_date.isoformat(),
                end=end_date.isoformat(),
                interval=yf_interval
            )
            
            result = []
            for idx, row in hist.iterrows():
                result.append(PriceData(
                    date=idx.strftime('%Y-%m-%d'),
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close']),
                    volume=int(row['Volume']) if 'Volume' in row else None
                ))
            
            return result
        except Exception as e:
            logger.error(f"Yahoo time series error for {symbol}: {e}")
            return []
    
    def get_forex_rates(
        self, 
        base_currency: str, 
        quote_currency: str, 
        start_date: date, 
        end_date: date
    ) -> List[ForexRate]:
        """Fetch historical forex rates"""
        try:
            # Yahoo uses format like "EURUSD=X"
            symbol = f"{base_currency}{quote_currency}=X"
            ticker = yf.Ticker(symbol)
            
            hist = ticker.history(
                start=start_date.isoformat(),
                end=end_date.isoformat(),
                interval="1d"
            )
            
            result = []
            for idx, row in hist.iterrows():
                result.append(ForexRate(
                    date=idx.strftime('%Y-%m-%d'),
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close'])
                ))
            
            return result
        except Exception as e:
            logger.error(f"Yahoo forex error for {base_currency}/{quote_currency}: {e}")
            return []
    
    def search_symbol(self, query: str, limit: int = 10) -> List[SearchResult]:
        """Search for symbols - limited in yfinance"""
        try:
            ticker = yf.Ticker(query)
            info = ticker.info
            
            if 'regularMarketPrice' in info or 'currentPrice' in info or 'previousClose' in info:
                return [SearchResult(
                    symbol=query.upper(),
                    name=info.get('shortName') or info.get('longName') or query.upper(),
                    type="stock",  # yfinance doesn't clearly distinguish
                    exchange=info.get('exchange', 'Unknown'),
                    currency=info.get('currency', 'USD')
                )]
            
            return []
        except Exception as e:
            logger.warning(f"Yahoo search error for {query}: {e}")
            return []
    
    def get_quote(self, symbol: str) -> Optional[QuoteData]:
        """Get current quote"""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
            if not price:
                return None
            
            return QuoteData(
                symbol=symbol.upper(),
                name=info.get('shortName') or info.get('longName') or symbol,
                price=float(price),
                change=float(info.get('regularMarketChange', 0)),
                change_percent=float(info.get('regularMarketChangePercent', 0)),
                currency=info.get('currency', 'USD'),
                exchange=info.get('exchange', ''),
                timestamp=""
            )
        except Exception as e:
            logger.error(f"Yahoo quote error for {symbol}: {e}")
            return None
    
    def get_forex_quote(self, base_currency: str, quote_currency: str) -> Optional[float]:
        """Get current forex rate"""
        try:
            symbol = f"{base_currency}{quote_currency}=X"
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            rate = info.get('regularMarketPrice') or info.get('previousClose')
            return float(rate) if rate else None
        except Exception as e:
            logger.error(f"Yahoo forex quote error: {e}")
            return None
