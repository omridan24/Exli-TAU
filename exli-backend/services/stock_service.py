import yfinance as yf
from config import logger

def search_symbol(query):
    """
    Searches for a stock ticker. 
    yfinance is great for data but doesn't have a fuzzy search.
    We try to match the query directly or common variations.
    """
    try:
        # Simple direct check first
        ticker = yf.Ticker(query)
        info = ticker.info
        
        # If we got valid info (check for a price field)
        if 'regularMarketPrice' in info or 'currentPrice' in info or 'previousClose' in info:
            return [{
                "symbol": query.upper(),
                "name": info.get('shortName') or info.get('longName') or query.upper(),
                "exchange": info.get('exchange', 'Unknown'),
                "currency": info.get('currency', 'USD'),
                "price": info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
            }]
        
        return []
    except Exception as e:
        logger.warning(f"Stock Search Warning for {query}: {e}")
        return []

def get_stock_details(symbol):
    """Fetches current price and 1-month history for the graph."""
    try:
        t = yf.Ticker(symbol)
        
        # Get history (1 month)
        hist = t.history(period="1mo")
        
        # Get Info
        info = t.info
        
        # Format history for Recharts
        graph_data = []
        for date, row in hist.iterrows():
            graph_data.append({
                "date": date.strftime('%Y-%m-%d'),
                "price": row['Close']
            })
            
        current_price = info.get('currentPrice') or info.get('regularMarketPrice') or (graph_data[-1]['price'] if graph_data else 0)
        
        return {
            "symbol": symbol.upper(),
            "price": current_price,
            "currency": info.get('currency', 'USD'),
            "name": info.get('shortName') or info.get('longName') or symbol,
            "change_percent": info.get('regularMarketChangePercent', 0),
            "history": graph_data
        }
    except Exception as e:
        logger.error(f"Stock Details Error: {e}")
        return None