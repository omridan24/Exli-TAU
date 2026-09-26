"""
Email Notification Service for Market Data Ingestion.
Sends summary emails after TwelveData API pulls.
"""
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from config import logger

# Configuration - set these in environment variables
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")  # Your Gmail address
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")  # Gmail App Password
NOTIFICATION_EMAIL = os.environ.get("NOTIFICATION_EMAIL", "admin@example.com")


def send_ingestion_report(
    date: str,
    environment: str,
    stocks_success: int,
    stocks_failed: int,
    stocks_skipped: int,
    currencies_success: int,
    currencies_failed: int,
    currencies_skipped: int,
    market_status: str = "Unknown",
    duration_seconds: float = 0,
    symbols_processed: list = None,
    time_budget_exceeded: bool = False,
    rate_limited: bool = False,
    tombstoned: int = 0,
    currencies_ingested: list = None
):
    """
    Send an email summary of market data ingestion.
    
    Args:
        date: Ingestion date
        environment: 'production' or 'development'
        stocks_success/failed/skipped: Stock ingestion counts
        currencies_success/failed/skipped: Currency ingestion counts
        market_status: Whether market was open or closed
        duration_seconds: How long the ingestion took
        symbols_processed: List of symbols that were processed
        tombstoned: Count of symbols/pairs newly marked permanently unavailable this run
        currencies_ingested: List of {"pair", "rate", "newPoints"} dicts for each
            currency pair that was actually fetched today, so the report shows
            the real exchange rates pulled in, not just a count
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("Email not configured (SMTP_USER/SMTP_PASSWORD missing). Skipping notification.")
        return False
    
    try:
        # Build email content
        subject = f"📊 Exli Market Data Ingestion - {environment.upper()} - {date}"
        
        # Calculate totals
        total_stocks = stocks_success + stocks_failed + stocks_skipped
        total_currencies = currencies_success + currencies_failed + currencies_skipped
        
        # Determine overall status
        if stocks_failed == 0 and currencies_failed == 0:
            status_emoji = "✅"
            status_text = "SUCCESS"
        elif stocks_failed > 0 or currencies_failed > 0:
            status_emoji = "⚠️"
            status_text = "PARTIAL SUCCESS"
        else:
            status_emoji = "❌"
            status_text = "FAILED"
        
        # Format duration
        if duration_seconds >= 60:
            duration_str = f"{duration_seconds / 60:.1f} minutes"
        else:
            duration_str = f"{duration_seconds:.1f} seconds"

        stop_reason = None
        if rate_limited:
            stop_reason = "Stopped early: provider appeared to be rate-limited"
        elif time_budget_exceeded:
            stop_reason = "Stopped early: hit today's time budget (rotation continues tomorrow)"

        tombstone_note = (
            f"{tombstoned} symbol(s)/pair(s) skipped as permanently unavailable (delisted, invalid, "
            f"or needs a higher TwelveData plan) - see the _system/deadSymbols doc"
        ) if tombstoned else None

        currencies_ingested = currencies_ingested or []
        currency_rows_html = "".join(
            f"""<tr>
                <td>{c['pair']}</td>
                <td>{c['rate']:.4f}</td>
                <td>{c.get('newPoints', '-')}</td>
            </tr>""" for c in currencies_ingested
        )
        currency_rows_text = "\n".join(
            f"  {c['pair']}: {c['rate']:.4f} (+{c.get('newPoints', '?')} new day(s))" for c in currencies_ingested
        )

        # Build HTML body
        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; }}
                .header {{ text-align: center; margin-bottom: 24px; }}
                .status {{ font-size: 24px; font-weight: bold; }}
                .stats-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }}
                .stat-card {{ background: #f8f9fa; border-radius: 8px; padding: 16px; }}
                .stat-label {{ color: #666; font-size: 12px; text-transform: uppercase; }}
                .stat-value {{ font-size: 24px; font-weight: bold; margin-top: 4px; }}
                .success {{ color: #10b981; }}
                .failed {{ color: #ef4444; }}
                .skipped {{ color: #6b7280; }}
                .meta {{ color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
                th, td {{ padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }}
                th {{ background: #f8f9fa; font-weight: 600; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="status">{status_emoji} {status_text}</div>
                    <p>Market Data Ingestion Report</p>
                </div>
                
                <table>
                    <tr>
                        <th>Metric</th>
                        <th>Stocks/ETFs</th>
                        <th>Currencies</th>
                    </tr>
                    <tr>
                        <td>✓ Success</td>
                        <td class="success">{stocks_success}</td>
                        <td class="success">{currencies_success}</td>
                    </tr>
                    <tr>
                        <td>✗ Failed</td>
                        <td class="failed">{stocks_failed}</td>
                        <td class="failed">{currencies_failed}</td>
                    </tr>
                    <tr>
                        <td>⏭ Skipped</td>
                        <td class="skipped">{stocks_skipped}</td>
                        <td class="skipped">{currencies_skipped}</td>
                    </tr>
                    <tr style="font-weight: bold;">
                        <td>Total</td>
                        <td>{total_stocks}</td>
                        <td>{total_currencies}</td>
                    </tr>
                </table>

                {"<h3>💱 Exchange Rates Fetched Today</h3><table><tr><th>Pair</th><th>Rate</th><th>New Days</th></tr>" + currency_rows_html + "</table>" if currencies_ingested else ""}

                <div class="meta">
                    <p><strong>Environment:</strong> {environment}</p>
                    <p><strong>Date:</strong> {date}</p>
                    <p><strong>Market Status:</strong> {market_status}</p>
                    <p><strong>Duration:</strong> {duration_str}</p>
                    {"<p><strong>Note:</strong> " + stop_reason + "</p>" if stop_reason else ""}
                    {"<p><strong>Note:</strong> " + tombstone_note + "</p>" if tombstone_note else ""}
                    <p><strong>Timestamp:</strong> {datetime.utcnow().isoformat()}Z</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text fallback
        text_body = f"""
Exli Market Data Ingestion Report
=================================

Status: {status_text}
Environment: {environment}
Date: {date}

STOCKS/ETFs:
  ✓ Success: {stocks_success}
  ✗ Failed: {stocks_failed}
  ⏭ Skipped: {stocks_skipped}
  Total: {total_stocks}

CURRENCIES:
  ✓ Success: {currencies_success}
  ✗ Failed: {currencies_failed}
  ⏭ Skipped: {currencies_skipped}
  Total: {total_currencies}
{chr(10) + "EXCHANGE RATES FETCHED TODAY:" + chr(10) + currency_rows_text if currencies_ingested else ""}

Market Status: {market_status}
Duration: {duration_str}
{stop_reason if stop_reason else ""}
{tombstone_note if tombstone_note else ""}
Timestamp: {datetime.utcnow().isoformat()}Z
        """
        
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = NOTIFICATION_EMAIL
        
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, NOTIFICATION_EMAIL, msg.as_string())
        
        logger.info(f"📧 Ingestion report email sent to {NOTIFICATION_EMAIL}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send ingestion report email: {e}")
        return False
