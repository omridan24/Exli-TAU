"""
Market Data Service - Main orchestrator for market data operations.
Handles provider selection, Firebase storage, and alias-based search.
"""
import os
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Tuple
from dataclasses import asdict

from google.cloud import firestore
from config import logger

from .providers import TwelveDataProvider, YahooProvider, MarketDataProvider
from .symbol_lists import (
    SYMBOL_ALIASES, 
    CURRENCY_ALIASES, 
    SP500_SYMBOLS, 
    ETFS, 
    CURRENCY_PAIRS,
    get_all_symbols
)


class MarketDataService:
    """
    Main service for market data operations.
    
    Features:
    - Provider abstraction (swap TwelveData/Yahoo easily)
    - Firebase caching with configurable TTL
    - Alias-based fuzzy search
    - Batch ingestion for daily updates
    """
    
    COLLECTION_NAME = "marketData"
    CURRENCIES_COLLECTION = "currencyRates"
    
    def __init__(self, provider: MarketDataProvider = None):
        """
        Initialize the service with a provider.
        
        Args:
            provider: Market data provider instance. 
                      Defaults to TwelveData if TWELVEDATA_API_KEY is set.
        """
        if provider:
            self._provider = provider
        else:
            # Auto-select provider based on available API keys
            api_key = os.environ.get("TWELVEDATA_API_KEY")
            if api_key:
                self._provider = TwelveDataProvider(api_key)
                logger.info("Using TwelveData provider")
            else:
                self._provider = YahooProvider()
                logger.info("Using Yahoo Finance provider (fallback)")
        
        # Initialize Firestore
        try:
            self._db = firestore.Client()
        except Exception as e:
            logger.warning(f"Firestore not available: {e}")
            self._db = None
    
    @property
    def provider(self) -> MarketDataProvider:
        return self._provider
    
    def switch_provider(self, provider: MarketDataProvider):
        """Hot-swap the data provider"""
        logger.info(f"Switching provider from {self._provider.name} to {provider.name}")
        self._provider = provider
    
    # ==================== Search ====================
    
    # Below this many local matches, we also ask TwelveData's live symbol search so
    # users can find (and then add) tickers we haven't ingested yet - this costs at
    # most 1 API credit per search (well under the free-tier 8/min cap given the
    # frontend debounces searches to 300ms after typing stops).
    LIVE_SEARCH_FALLBACK_THRESHOLD = 5

    def search_symbols(self, query: str, limit: int = 20) -> List[Dict]:
        """
        Search for symbols, preferring our Firebase database (free, instant,
        alias-aware) and falling back to a live TwelveData symbol search when
        the local database doesn't have enough matches. Live results are
        clearly flagged (inDatabase: False) so the caller can prompt the user
        to confirm before it's added - the full price history for whichever
        one the user actually picks is fetched lazily by /market/symbol/<symbol>.
        """
        query_lower = query.lower().strip()
        results = []
        seen_symbols = set()

        if self._db:
            try:
                # Get all symbols from our database
                docs = self._db.collection(self.COLLECTION_NAME).stream()

                for doc in docs:
                    data = doc.to_dict()
                    symbol = data.get("symbol", doc.id)
                    name = data.get("name", "")
                    aliases = data.get("aliases", [])

                    # Check if query matches symbol, name, or any alias
                    matches = (
                        query_lower in symbol.lower() or
                        query_lower in name.lower() or
                        any(query_lower in alias.lower() for alias in aliases)
                    )

                    if matches and symbol not in seen_symbols:
                        results.append({
                            "symbol": symbol,
                            "name": name,
                            "type": data.get("type", "stock"),
                            "currentPrice": data.get("currentPrice"),
                            "changePercent": data.get("changePercent"),
                            "inDatabase": True  # Flag for frontend
                        })
                        seen_symbols.add(symbol)

                        if len(results) >= limit:
                            break

            except Exception as e:
                logger.error(f"Local search failed: {e}")

        # Live fallback: only when the local DB came up short, and only for
        # queries that look like a real search term (avoid burning credits on
        # single-character or empty queries the caller may still send).
        if len(results) < self.LIVE_SEARCH_FALLBACK_THRESHOLD and len(query_lower) >= 2:
            try:
                live_matches = self._provider.search_symbol(query, limit=limit)
                for m in live_matches:
                    if m.symbol in seen_symbols:
                        continue
                    # search_symbol() lowercases instrument_type already (e.g. "common stock", "etf")
                    if "stock" not in m.type and "etf" not in m.type:
                        continue  # skip bonds/indices/mutual funds/other types we don't support
                    results.append({
                        "symbol": m.symbol,
                        "name": m.name,
                        "type": "etf" if "etf" in m.type.lower() else "stock",
                        "currentPrice": None,
                        "changePercent": None,
                        "inDatabase": False  # Not cached yet - picking it triggers a live fetch
                    })
                    seen_symbols.add(m.symbol)
                    if len(results) >= limit:
                        break
            except Exception as e:
                logger.warning(f"Live symbol search fallback failed for '{query}': {e}")

        return results[:limit]
    
    # ==================== Data Retrieval ====================
    
    def get_symbol_data(self, symbol: str, use_cache: bool = True) -> Optional[Dict]:
        """
        Get price data for a symbol.
        
        Returns cached Firebase data if available and fresh,
        otherwise fetches from provider.
        """
        # Try cache first
        if use_cache and self._db:
            cached = self._get_cached_data(symbol)
            if cached and self._is_cache_fresh(cached):
                return cached
        
        # Fetch fresh data
        end_date = date.today()
        start_date = end_date - timedelta(days=365)
        
        try:
            price_data = self._provider.get_time_series(symbol, start_date, end_date)
            if not price_data:
                return None
            
            quote = self._provider.get_quote(symbol)
            
            result = {
                "symbol": symbol,
                "name": quote.name if quote else symbol,
                "type": "etf" if symbol in ETFS else "stock",
                "currency": quote.currency if quote else "USD",
                "currentPrice": quote.price if quote else price_data[-1].close,
                "change": quote.change if quote else 0,
                "changePercent": quote.change_percent if quote else 0,
                "priceHistory": [asdict(p) for p in price_data],
                "aliases": SYMBOL_ALIASES.get(symbol, []),
                "lastUpdated": datetime.utcnow().isoformat()
            }
            
            # Cache to Firebase
            if self._db:
                self._cache_data(symbol, result)
            
            return result
        except Exception as e:
            logger.error(f"Failed to get data for {symbol}: {e}")
            return None
    
    def get_currency_rate(self, base: str, quote: str = "ILS", use_cache: bool = True) -> Optional[Dict]:
        """Get currency exchange rate data"""
        symbol = f"{base}/{quote}"
        
        # Try cache
        if use_cache and self._db:
            cached = self._get_cached_currency(symbol)
            if cached and self._is_cache_fresh(cached):
                return cached
        
        # Fetch fresh
        end_date = date.today()
        start_date = end_date - timedelta(days=365)
        
        try:
            rates = self._provider.get_forex_rates(base, quote, start_date, end_date)
            if not rates:
                return None
            
            current_rate = self._provider.get_forex_quote(base, quote)
            
            result = {
                "symbol": symbol,
                "baseCurrency": base,
                "quoteCurrency": quote,
                "type": "forex",
                "currentRate": current_rate or rates[-1].close,
                "rateHistory": [asdict(r) for r in rates],
                "aliases": CURRENCY_ALIASES.get(base, []),
                "lastUpdated": datetime.utcnow().isoformat()
            }
            
            # Cache
            if self._db:
                self._cache_currency(symbol, result)
            
            return result
        except Exception as e:
            logger.error(f"Failed to get currency data for {symbol}: {e}")
            return None
    
    # ==================== Batch Operations ====================
    
    def ingest_all_symbols(self, progress_callback=None) -> Tuple[int, int]:
        """
        Ingest all configured symbols (stocks + ETFs).
        
        Returns:
            Tuple of (success_count, failure_count)
        """
        symbols = get_all_symbols()
        success = 0
        failed = 0
        
        for i, symbol in enumerate(symbols):
            try:
                data = self.get_symbol_data(symbol, use_cache=False)
                if data:
                    success += 1
                else:
                    failed += 1
                    logger.warning(f"No data for {symbol}")
                
                if progress_callback:
                    progress_callback(i + 1, len(symbols), symbol)
                    
            except Exception as e:
                failed += 1
                logger.error(f"Failed to ingest {symbol}: {e}")
        
        return success, failed
    
    def ingest_all_currencies(self, progress_callback=None) -> Tuple[int, int]:
        """Ingest all configured currency pairs"""
        success = 0
        failed = 0
        
        for i, (base, quote) in enumerate(CURRENCY_PAIRS):
            try:
                data = self.get_currency_rate(base, quote, use_cache=False)
                if data:
                    success += 1
                else:
                    failed += 1
                
                if progress_callback:
                    progress_callback(i + 1, len(CURRENCY_PAIRS), f"{base}/{quote}")
                    
            except Exception as e:
                failed += 1
                logger.error(f"Failed to ingest {base}/{quote}: {e}")
        
        return success, failed
    
    # ==================== Firebase Cache Operations ====================
    
    def _get_cached_data(self, symbol: str) -> Optional[Dict]:
        """Get cached symbol data from Firebase"""
        try:
            doc = self._db.collection(self.COLLECTION_NAME).document(symbol).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.warning(f"Cache read failed for {symbol}: {e}")
            return None
    
    def _cache_data(self, symbol: str, data: Dict):
        """Cache symbol data to Firebase"""
        try:
            self._db.collection(self.COLLECTION_NAME).document(symbol).set(data)
        except Exception as e:
            logger.warning(f"Cache write failed for {symbol}: {e}")
    
    def _get_cached_currency(self, symbol: str) -> Optional[Dict]:
        """Get cached currency data"""
        try:
            # Use underscore instead of slash for document ID
            doc_id = symbol.replace("/", "_")
            doc = self._db.collection(self.CURRENCIES_COLLECTION).document(doc_id).get()
            return doc.to_dict() if doc.exists else None
        except Exception as e:
            logger.warning(f"Currency cache read failed: {e}")
            return None
    
    def _cache_currency(self, symbol: str, data: Dict):
        """Cache currency data"""
        try:
            doc_id = symbol.replace("/", "_")
            self._db.collection(self.CURRENCIES_COLLECTION).document(doc_id).set(data)
        except Exception as e:
            logger.warning(f"Currency cache write failed: {e}")
    
    def _is_cache_fresh(self, data: Dict, max_age_hours: int = 24) -> bool:
        """Check if cached data is still fresh"""
        try:
            last_updated = datetime.fromisoformat(data.get("lastUpdated", ""))
            age = datetime.utcnow() - last_updated
            return age.total_seconds() < max_age_hours * 3600
        except Exception:
            return False
    
    # ==================== Utility Methods ====================
    
    def get_all_cached_symbols(self) -> List[str]:
        """Get list of all symbols in cache"""
        if not self._db:
            return []
        try:
            docs = self._db.collection(self.COLLECTION_NAME).stream()
            return [doc.id for doc in docs]
        except Exception as e:
            logger.error(f"Failed to list cached symbols: {e}")
            return []
    
    def get_all_cached_currencies(self) -> List[Dict]:
        """Get all cached currency rates"""
        if not self._db:
            return []
        try:
            docs = self._db.collection(self.CURRENCIES_COLLECTION).stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            logger.error(f"Failed to list currencies: {e}")
            return []
