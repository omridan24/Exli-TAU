"""
Tests for the ingestion report email - specifically that the exchange rates
actually fetched each day are included, not just a success count (requested
2026-09-26 after the market-ingest fix shipped).
"""
from email import message_from_string
from unittest.mock import MagicMock, patch

from services import email_service


def _decoded_parts(raw_message: str) -> str:
    """The email is multipart with base64-encoded bodies - decode both parts
    so tests can assert on their actual text content."""
    msg = message_from_string(raw_message)
    return "\n".join(
        part.get_payload(decode=True).decode("utf-8", errors="replace")
        for part in msg.walk()
        if part.get_content_maintype() == "text"
    )


def _send(**overrides):
    kwargs = dict(
        date="2026-09-26",
        environment="production",
        stocks_success=10,
        stocks_failed=0,
        stocks_skipped=0,
        currencies_success=2,
        currencies_failed=0,
        currencies_skipped=0,
    )
    kwargs.update(overrides)
    with patch.object(email_service, "SMTP_USER", "bot@example.com"), \
         patch.object(email_service, "SMTP_PASSWORD", "secret"), \
         patch("smtplib.SMTP") as mock_smtp:
        instance = MagicMock()
        mock_smtp.return_value.__enter__.return_value = instance
        result = email_service.send_ingestion_report(**kwargs)
        # Both the HTML and plain-text bodies get attached to the message and
        # base64-encoded - decode them so assertions can check real content.
        raw_message = instance.sendmail.call_args[0][2]
        return result, _decoded_parts(raw_message)


class TestCurrenciesInEmail:
    def test_no_currencies_ingested_omits_the_section(self):
        ok, body = _send(currencies_ingested=[])
        assert ok is True
        assert "Exchange Rates Fetched Today" not in body
        assert "EXCHANGE RATES FETCHED TODAY" not in body

    def test_ingested_currencies_appear_with_their_rate(self):
        ok, body = _send(currencies_ingested=[
            {"pair": "USD/ILS", "rate": 3.4013, "newPoints": 1},
            {"pair": "EUR/ILS", "rate": 3.9661, "newPoints": 1},
        ])
        assert ok is True
        assert "USD/ILS" in body
        assert "3.4013" in body
        assert "EUR/ILS" in body
        assert "3.9661" in body

    def test_missing_currencies_ingested_defaults_gracefully(self):
        # No currencies_ingested kwarg at all (older caller) must not crash.
        ok, body = _send()
        assert ok is True
