#!/usr/bin/env python3
"""
Test script to verify TwelveData API integration.
Fetches 10 stocks with 1-year history to validate the setup.

Usage:
    python scripts/test_twelvedata.py
    
    Or with explicit API key:
    python scripts/test_twelvedata.py --api-key YOUR_KEY
"""
import os
import sys
import argparse
from datetime import date, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


def main():
    parser = argparse.ArgumentParser(description='Test TwelveData API integration')
    parser.add_argument('--api-key', help='TwelveData API key (or set TWELVEDATA_API_KEY env var)')
    args = parser.parse_args()
    
    api_key = args.api_key or os.environ.get('TWELVEDATA_API_KEY')
    if not api_key:
        print("❌ ERROR: No API key provided.")
        print("   Set TWELVEDATA_API_KEY environment variable or use --api-key flag")
        sys.exit(1)
    
    print("=" * 60)
    print("🧪 TwelveData API Integration Test")
    print("=" * 60)
    
    # Import provider
    from services.providers.twelvedata_provider import TwelveDataProvider
    
    provider = TwelveDataProvider(api_key)
    
    # Test symbols
    test_symbols = [
        "AAPL",   # Apple
        "MSFT",   # Microsoft
        "GOOGL",  # Alphabet
        "AMZN",   # Amazon
        "TSLA",   # Tesla
        "META",   # Meta
        "NVDA",   # NVIDIA
        "JPM",    # JP Morgan
        "V",      # Visa
        "JNJ",    # Johnson & Johnson
    ]
    
    # Date range (1 year back)
    end_date = date.today()
    start_date = end_date - timedelta(days=365)
    
    print(f"\n📅 Date Range: {start_date} to {end_date}")
    print(f"📊 Testing {len(test_symbols)} symbols...\n")
    
    success_count = 0
    failed_symbols = []
    
    for symbol in test_symbols:
        print(f"  {symbol}: ", end="", flush=True)
        
        try:
            data = provider.get_time_series(symbol, start_date, end_date)
            
            if data and len(data) > 0:
                print(f"✅ {len(data)} data points")
                print(f"      First: {data[0].date} @ ${data[0].close:.2f}")
                print(f"      Last:  {data[-1].date} @ ${data[-1].close:.2f}")
                success_count += 1
            else:
                print("❌ No data returned")
                failed_symbols.append(symbol)
                
        except Exception as e:
            print(f"❌ Error: {e}")
            failed_symbols.append(symbol)
    
    # Test forex
    print("\n📈 Testing Forex (USD/ILS)...")
    try:
        forex_data = provider.get_forex_rates("USD", "ILS", start_date, end_date)
        if forex_data:
            print(f"  ✅ {len(forex_data)} rate points")
            print(f"     Current rate: {forex_data[-1].close:.4f} ILS per USD")
        else:
            print("  ❌ No forex data")
    except Exception as e:
        print(f"  ❌ Forex error: {e}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📋 Summary")
    print("=" * 60)
    print(f"  ✅ Successful: {success_count}/{len(test_symbols)}")
    
    if failed_symbols:
        print(f"  ❌ Failed: {', '.join(failed_symbols)}")
    
    if success_count == len(test_symbols):
        print("\n🎉 All tests passed! TwelveData integration is working.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check API key and rate limits.")
        sys.exit(1)


if __name__ == "__main__":
    main()
