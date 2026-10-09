#!/usr/bin/env python3
"""
FX (exchange rate) backfill script - Phase 1 of docs/fx/01-fx-plan.md.

One-time (or re-run-if-needed) historical backfill of every supported
currency's rate against USD, from a given start date up to today. This is
the same run_fx_ingestion() the daily /system/ingest-fx endpoint uses -
just with a much wider lookback window - so a backfill and a daily run
merge into fxRates/{year} the exact same way (idempotent, safe to re-run).

TwelveData's time_series caps at outputsize=5000 per call; ~11 years of
weekdays (2015-today) is under 3000 daily bars, so each currency backfills
in a single API call.

Usage:
    # Full backfill from 2015 (one call per supported currency, ~6 minutes)
    python scripts/backfill_fx.py --from 2015-01-01

    # Limited run (for testing - only the first N currencies)
    python scripts/backfill_fx.py --from 2015-01-01 --limit 3
"""
import argparse
import os
import sys
from datetime import date, datetime

# Windows terminals often default to a legacy codepage that can't encode the
# emoji this script prints - reconfigure to UTF-8 so it doesn't crash there.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


def main():
    parser = argparse.ArgumentParser(description='Backfill FX (exchange rate) history into Firestore')
    parser.add_argument('--from', dest='from_date', required=True, help='Start date, YYYY-MM-DD (e.g. 2015-01-01)')
    parser.add_argument('--limit', type=int, default=0, help='Limit to the first N currencies (for testing)')
    parser.add_argument('--currencies', help='Comma-separated currency codes to run instead of the full list '
                                              '(e.g. to resume after a rate-limited run stopped partway through)')
    parser.add_argument('--api-key', help='TwelveData API key (defaults to TWELVEDATA_API_KEY env var)')
    args = parser.parse_args()

    from_date = datetime.strptime(args.from_date, '%Y-%m-%d').date()
    today = date.today()
    lookback_days = (today - from_date).days
    if lookback_days <= 0:
        print("ERROR: --from must be a date in the past")
        sys.exit(1)

    api_key = args.api_key or os.environ.get('TWELVEDATA_API_KEY')
    if not api_key:
        print("❌ ERROR: No API key. Set TWELVEDATA_API_KEY or use --api-key")
        sys.exit(1)

    from google.cloud import firestore
    from services.providers.twelvedata_provider import TwelveDataProvider
    from services.symbol_lists import CURRENCY_PAIRS
    from services.fx_ingest_service import run_fx_ingestion, usd_pivot_currencies

    if args.currencies:
        currencies = [c.strip().upper() for c in args.currencies.split(',') if c.strip()]
    else:
        currencies = usd_pivot_currencies(CURRENCY_PAIRS)
    if args.limit:
        currencies = currencies[:args.limit]

    print("=" * 70)
    print("💱 FX Backfill")
    print("=" * 70)
    print(f"  From: {from_date} ({lookback_days} days ago)")
    print(f"  Currencies: {len(currencies)}")
    print()

    try:
        db = firestore.Client()
        print("✅ Connected to Firebase\n")
    except Exception as e:
        print(f"❌ Firebase connection failed: {e}")
        print("   Make sure GOOGLE_APPLICATION_CREDENTIALS is set or you're authenticated via gcloud\n")
        sys.exit(1)

    provider = TwelveDataProvider(api_key)

    outcome = run_fx_ingestion(db, provider, currencies, today=today, lookback_days=lookback_days)

    print(f"  ✅ Fetched: {len(outcome['success'])} - {', '.join(outcome['success'])}")
    if outcome['unsupported']:
        print(f"  ⏭  Unsupported (no TwelveData data): {len(outcome['unsupported'])} - {', '.join(outcome['unsupported'])}")
    if outcome['failed']:
        print(f"  ❌ Failed: {len(outcome['failed'])} - {', '.join(outcome['failed'])}")
    if outcome['rateLimited']:
        print("  ⚠️  Stopped early: provider appeared to be rate-limited. Currencies fetched before the stop are")
        print("     already saved - just re-run this script (perhaps after a pause) to pick up the rest.")
    if outcome['newlyClassified']:
        print(f"  📋 Classified: {outcome['newlyClassified']}")

    print("\n" + "=" * 70)
    print("✅ Backfill Complete")
    print("=" * 70)


if __name__ == "__main__":
    main()
