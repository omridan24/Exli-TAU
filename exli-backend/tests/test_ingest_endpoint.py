"""
Tests for the /system/ingest-market-data route's dev-environment guard
(requested 2026-09-26): the dev Cloud Run service (exli-processor-dev)
must never actually run ingestion or send a report email - only prod does.

This talks to the real Flask app via its test client, but never touches
Firestore or the network: the dev-host request is refused before either
is reached, which is exactly the behavior under test.
"""
from unittest.mock import patch

import main

TEST_KEY = "test-system-key-for-ingest-endpoint-tests"


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
                "/system/ingest-market-data",
                headers={"X-System-Key": TEST_KEY, "Host": "exli-processor-dev-abc123.a.run.app"},
            )
            assert resp.status_code == 200
            body = resp.get_json()
            assert body["status"] == "skipped"
            assert "production" in body["message"].lower()
            mock_firestore.assert_not_called()
            mock_provider.assert_not_called()

    def test_dev_host_is_skipped_even_with_force_and_limit(self):
        # force/limit used to let a manual test run against dev slip through -
        # the dev guard must win regardless of those params.
        client = _client()
        with patch.object(main.Config, "SYSTEM_API_KEY", TEST_KEY), \
             patch("google.cloud.firestore.Client") as mock_firestore:
            resp = client.post(
                "/system/ingest-market-data?force=true&limit=5",
                headers={"X-System-Key": TEST_KEY, "Host": "exli-processor-dev-abc123.a.run.app"},
            )
            assert resp.get_json()["status"] == "skipped"
            mock_firestore.assert_not_called()

    def test_unauthorized_request_is_still_rejected_before_the_dev_check(self):
        client = _client()
        with patch.object(main.Config, "SYSTEM_API_KEY", TEST_KEY):
            resp = client.post(
                "/system/ingest-market-data",
                headers={"X-System-Key": "wrong-key", "Host": "exli-processor-dev-abc123.a.run.app"},
            )
            assert resp.status_code == 401
