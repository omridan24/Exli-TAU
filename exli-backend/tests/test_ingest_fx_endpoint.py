"""
Tests for the /system/ingest-fx route (docs/fx/01-fx-plan.md §2.3) - the
dev-environment guard (same policy as /system/ingest-market-data) and the
happy path, wired end-to-end against the fake Firestore client instead of
a live database.
"""
from datetime import date
from unittest.mock import MagicMock, patch

import main
from services.providers.market_data_provider import ForexRate
from tests.fake_firestore import FakeClient

TEST_KEY = "test-system-key-for-fx-endpoint-tests"


def _client():
    main.app.config["TESTING"] = True
    return main.app.test_client()


class TestDevEnvironmentIsRefused:
    def test_dev_host_is_skipped_without_touching_firestore_or_provider(self):
        client = _client()
        with patch.object(main.Config, "SYSTEM_API_KEY", TEST_KEY), \
             patch("google.cloud.firestore.Client") as mock_firestore, \
             patch("services.providers.twelvedata_provider.TwelveDataProvider") as mock_provider:
            resp = client.post(
                "/system/ingest-fx",
                headers={"X-System-Key": TEST_KEY, "Host": "exli-processor-dev-abc123.a.run.app"},
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["status"] == "skipped"
            assert "production" in body["message"].lower()
            mock_firestore.assert_not_called()
            mock_provider.assert_not_called()

    def test_unauthorized_request_is_rejected(self):
        client = _client()
        with patch.object(main.Config, "SYSTEM_API_KEY", TEST_KEY):
            resp = client.post(
                "/system/ingest-fx",
                headers={"X-System-Key": "wrong-key", "Host": "exli-processor-dev-abc123.a.run.app"},
            )
            assert resp.status_code == 401


class TestHappyPath:
    def test_successful_run_writes_meta_and_returns_summary(self):
        client = _client()
        fake_db = FakeClient()
        fake_provider = MagicMock()
        fake_provider.get_forex_rates.return_value = [
            ForexRate(date="2026-09-26", open=3.4, high=3.4, low=3.4, close=3.4)
        ]

        with patch.object(main.Config, "SYSTEM_API_KEY", TEST_KEY), \
             patch.object(main.Config, "TWELVEDATA_API_KEY", "fake-key"), \
             patch("google.cloud.firestore.Client", return_value=fake_db), \
             patch("services.providers.twelvedata_provider.TwelveDataProvider", return_value=fake_provider), \
             patch("services.fx_ingest_service.time.sleep") as mock_sleep, \
             patch("services.email_service.send_fx_ingestion_report") as mock_email:
            resp = client.post(
                "/system/ingest-fx?lookback=0",
                headers={"X-System-Key": TEST_KEY, "Host": "exli-processor-abc123.a.run.app"},
            )

        # The route ingests the full ~50-currency list, which crosses several
        # DEFAULT_BATCH_SIZE pacing boundaries - assert the pacing is exercised
        # without this test actually waiting on it.
        assert mock_sleep.called

        assert resp.status_code == 200
        body = resp.get_json()
        assert body["status"] == "success"
        assert body["successCount"] > 0
        mock_email.assert_called_once()

        meta = fake_db.collection("_system").document("fxIngestMeta").get().to_dict()
        assert meta["lastIngestionDate"] == body["date"]

    def test_second_call_same_day_is_skipped_without_force(self):
        client = _client()
        fake_db = FakeClient()
        fake_db.collection("_system").document("fxIngestMeta").set(
            {"lastIngestionDate": date.today().isoformat()}
        )

        with patch.object(main.Config, "SYSTEM_API_KEY", TEST_KEY), \
             patch.object(main.Config, "TWELVEDATA_API_KEY", "fake-key"), \
             patch("google.cloud.firestore.Client", return_value=fake_db):
            resp = client.post(
                "/system/ingest-fx",
                headers={"X-System-Key": TEST_KEY, "Host": "exli-processor-abc123.a.run.app"},
            )

        assert resp.get_json()["status"] == "skipped"
