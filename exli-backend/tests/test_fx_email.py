"""Tests for the FX ingestion report email (services.email_service.send_fx_ingestion_report)."""
from unittest.mock import MagicMock, patch

from services import email_service
from tests.test_email_service import _decoded_parts


def _send(**overrides):
    kwargs = dict(
        date="2026-09-26",
        success=["USD", "ILS", "EUR"],
        unsupported=[],
        failed=[],
    )
    kwargs.update(overrides)
    with patch.object(email_service, "SMTP_USER", "bot@example.com"), \
         patch.object(email_service, "SMTP_PASSWORD", "secret"), \
         patch("smtplib.SMTP") as mock_smtp:
        instance = MagicMock()
        mock_smtp.return_value.__enter__.return_value = instance
        result = email_service.send_fx_ingestion_report(**kwargs)
        raw_message = instance.sendmail.call_args[0][2]
        return result, _decoded_parts(raw_message)


class TestFxIngestionEmail:
    def test_basic_success_report(self):
        ok, body = _send()
        assert ok is True
        assert "SUCCESS" in body

    def test_staleness_warning_is_surfaced(self):
        ok, body = _send(staleness_warning="FX rates are stale: fxRates/latest is from 2026-01-31, 12 business day(s) ago")
        assert ok is True
        assert "STALE" in body
        assert "2026-01-31" in body

    def test_newly_classified_currencies_are_listed(self):
        ok, body = _send(newly_classified={"EUR": "inverted", "ILS": "direct"})
        assert ok is True
        assert "EUR" in body
        assert "inverted" in body

    def test_failed_currencies_are_named(self):
        ok, body = _send(failed=["XYZ", "ABC"])
        assert ok is True
        assert "XYZ" in body
        assert "ABC" in body

    def test_rate_limited_note_appears(self):
        ok, body = _send(rate_limited=True)
        assert ok is True
        assert "rate-limited" in body.lower()
