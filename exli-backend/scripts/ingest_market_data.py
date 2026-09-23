#!/usr/bin/env python3
"""
Market Data Ingestion Script.
Fetches historical data for all configured stocks, ETFs, and currencies,
stores them in Firebase.

This script is designed to be run:
1. Initially: To backfill 1 year of historical data
2. Daily: As a cron job to update with the latest day's data

Usage:
    # Full backfill (first time)
    python scripts/ingest_market_data.py --full
    
    # Daily update
    python scripts/ingest_market_data.py --daily
    
    # Dry run (no Firebase writes)
    python scripts/ingest_market_data.py --full --dry-run
    
    # Limited run (for testing)
    python scripts/ingest_market_data.py --full --limit 10
"""
import os
import sys
import argparse
import time
from datetime import date, timedelta, datetime
from dataclasses import asdict

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


def progress_callback(current, total, symbol):
    """Print progress during ingestion"""
    pct = (current / total) * 100
    bar_len = 30
    filled = int(bar_len * current / total)
    bar = '█' * filled + '░' * (bar_len - filled)
    print(f"\r  [{bar}] {pct:5.1f}% ({current}/{total}) - {symbol:10s}", end="", flush=True)


def main():
    parser = argparse.ArgumentParser(description='Ingest market data into Firebase')
    parser.add_argument('--full', action='store_true', help='Full backfill (1 year history)')
    parser.add_argument('--daily', action='store_true', help='Daily update (only latest data)')
    parser.add_argument('--dry-run', action='store_true', help='Simulate without writing to Firebase')
    parser.add_argument('--symbols-only', action='store_true', help='Only ingest stocks/ETFs, skip currencies')
    parser.add_argument('--currencies-only', action='store_true', help='Only ingest currencies, skip stocks/ETFs')
    parser.add_argument('--batch-size', type=int, default=8, help='API calls per minute (rate limiting)')
    parser.add_argument('--limit', type=int, default=0, help='Limit number of symbols to process (for testing)')
    parser.add_argument('--api-key', help='TwelveData API key')
    args = parser.parse_args()
    
    if not args.full and not args.daily:
        print("ERROR: Specify either --full or --daily")
        parser.print_help()
        sys.exit(1)
    
    api_key = args.api_key or os.environ.get('TWELVEDATA_API_KEY')
    if not api_key:
        print("❌ ERROR: No API key. Set TWELVEDATA_API_KEY or use --api-key")
        sys.exit(1)
    
    print("=" * 70)
    print("📊 Market Data Ingestion")
    print("=" * 70)
    print(f"  Mode: {'Full Backfill' if args.full else 'Daily Update'}")
    print(f"  Dry Run: {'Yes' if args.dry_run else 'No'}")
    print(f"  Batch Size: {args.batch_size} calls/minute")
    if args.limit:
        print(f"  Limit: {args.limit} symbols")
    print()
    
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No data will be written to Firebase\n")
    
    # Import services
    from services.providers.twelvedata_provider import TwelveDataProvider
    from services.symbol_lists import get_all_symbols, CURRENCY_PAIRS, SYMBOL_ALIASES, CURRENCY_ALIASES, ETFS
    
    provider = TwelveDataProvider(api_key)
    
    # Initialize Firestore if not dry run
    db = None
    if not args.dry_run:
        try:
            from google.cloud import firestore
            db = firestore.Client()
            print("✅ Connected to Firebase\n")
        except Exception as e:
            print(f"❌ Firebase connection failed: {e}")
            print("   Make sure GOOGLE_APPLICATION_CREDENTIALS is set or you're authenticated via gcloud\n")
            sys.exit(1)
    
    # Get symbol lists
    all_symbols = get_all_symbols()
    if args.limit:
        all_symbols = all_symbols[:args.limit]
    
    currency_pairs = CURRENCY_PAIRS
    if args.limit:
        currency_pairs = currency_pairs[:min(args.limit, len(CURRENCY_PAIRS))]
    
    print(f"📋 Symbols to process: {len(all_symbols)} stocks/ETFs, {len(currency_pairs)} currencies")
    
    start_time = time.time()
    
    # --- Process Stocks/ETFs ---
    if not args.currencies_only:
        print(f"\n📈 Processing Stocks & ETFs ({len(all_symbols)} symbols)...")
        
        end_date = date.today()
        start_date = end_date - timedelta(days=365 if args.full else 7)
        
        success = 0
        failed = 0
        
        for i, symbol in enumerate(all_symbols):
            try:
                data = provider.get_time_series(symbol, start_date, end_date)
                
                if data:
                    success += 1

                    if not args.dry_run and db:
                        # Merge with any existing history rather than overwriting the
                        # document - a --daily run only fetches the last 7 days, so a
                        # plain .set() would silently discard everything older than
                        # that on every run after the initial --full backfill.
                        doc_ref = db.collection("marketData").document(symbol)
                        existing = doc_ref.get()
                        existing_history = existing.to_dict().get("priceHistory", []) if existing.exists else []
                        existing_dates = {p.get("date") for p in existing_history}
                        merged_history = existing_history + [asdict(p) for p in data if p.date not in existing_dates]
                        merged_history.sort(key=lambda p: p["date"])

                        quote = provider.get_quote(symbol)
                        doc_data = {
                            "symbol": symbol,
                            "name": quote.name if quote else symbol,
                            "type": "etf" if symbol in ETFS else "stock",
                            "currency": quote.currency if quote else "USD",
                            "exchange": quote.exchange if quote else "",
                            "currentPrice": quote.price if quote else (data[-1].close if data else 0),
                            "change": quote.change if quote else 0,
                            "changePercent": quote.change_percent if quote else 0,
                            "priceHistory": merged_history,
                            "aliases": SYMBOL_ALIASES.get(symbol, []),
                            "lastUpdated": datetime.utcnow().isoformat()
                        }

                        # Write to Firebase
                        doc_ref.set(doc_data)
                else:
                    failed += 1
                
                progress_callback(i + 1, len(all_symbols), symbol)
                
                # Rate limiting
                if (i + 1) % args.batch_size == 0 and (i + 1) < len(all_symbols):
                    print(f"\n  ⏳ Rate limit pause (60s)...")
                    time.sleep(60)
                    
            except Exception as e:
                failed += 1
                print(f"\n  ❌ {symbol}: {e}")
        
        print(f"\n  ✅ Stocks/ETFs: {success} succeeded, {failed} failed")
    
    # --- Process Currencies ---
    if not args.symbols_only:
        print(f"\n💱 Processing Currencies ({len(currency_pairs)} pairs)...")
        
        end_date = date.today()
        start_date = end_date - timedelta(days=365 if args.full else 7)
        
        success = 0
        failed = 0
        
        for i, (base, quote) in enumerate(currency_pairs):
            try:
                data = provider.get_forex_rates(base, quote, start_date, end_date)
                
                if data:
                    success += 1
                    
                    if not args.dry_run and db:
                        symbol = f"{base}/{quote}"
                        doc_id = f"{base}_{quote}"  # Use underscore for document ID

                        # Merge with existing history for the same reason as the stocks
                        # loop above - avoid discarding everything older than this run's window.
                        doc_ref = db.collection("currencyRates").document(doc_id)
                        existing = doc_ref.get()
                        existing_history = existing.to_dict().get("rateHistory", []) if existing.exists else []
                        existing_dates = {r.get("date") for r in existing_history}
                        merged_history = existing_history + [asdict(r) for r in data if r.date not in existing_dates]
                        merged_history.sort(key=lambda r: r["date"])

                        current_rate = provider.get_forex_quote(base, quote)

                        doc_data = {
                            "symbol": symbol,
                            "baseCurrency": base,
                            "quoteCurrency": quote,
                            "type": "forex",
                            "currentRate": current_rate or (data[-1].close if data else 0),
                            "rateHistory": merged_history,
                            "aliases": CURRENCY_ALIASES.get(base, []),
                            "lastUpdated": datetime.utcnow().isoformat()
                        }

                        # Write to Firebase
                        doc_ref.set(doc_data)
                else:
                    failed += 1
                
                progress_callback(i + 1, len(currency_pairs), f"{base}/{quote}")
                
                # Rate limiting
                if (i + 1) % args.batch_size == 0 and (i + 1) < len(currency_pairs):
                    print(f"\n  ⏳ Rate limit pause (60s)...")
                    time.sleep(60)
                    
            except Exception as e:
                failed += 1
                print(f"\n  ❌ {base}/{quote}: {e}")
        
        print(f"\n  ✅ Currencies: {success} succeeded, {failed} failed")
    
    # Summary
    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print(f"✅ Ingestion Complete in {elapsed/60:.1f} minutes")
    print("=" * 70)
    
    if args.dry_run:
        print("\n⚠️  This was a dry run. Re-run without --dry-run to save to Firebase.")


if __name__ == "__main__":
    main()
