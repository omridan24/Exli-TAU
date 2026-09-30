"""
Unit tests for utils/auth.py's decorators. Mocks firebase_admin.auth.verify_id_token
instead of hitting real Firebase, and uses a Flask test app so `g`/`request` behave
normally.
"""
import os
import sys
from unittest.mock import patch

import pytest
from flask import Flask, jsonify

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import utils.auth as auth_module
from utils.auth import require_auth, require_whitelisted


@pytest.fixture
def app():
    app = Flask(__name__)

    @app.route("/whoami")
    @require_auth
    def whoami():
        from flask import g
        return jsonify({"uid": g.uid, "email": g.email})

    @app.route("/whitelisted-only")
    @require_auth
    @require_whitelisted
    def whitelisted_only():
        return jsonify({"status": "ok"})

    return app


@pytest.fixture
def client(app):
    return app.test_client()


class TestRequireAuth:
    def test_missing_header_returns_401(self, client):
        resp = client.get("/whoami")
        assert resp.status_code == 401
        assert resp.get_json()["code"] == "UNAUTHENTICATED"

    def test_non_bearer_header_returns_401(self, client):
        resp = client.get("/whoami", headers={"Authorization": "Basic abc123"})
        assert resp.status_code == 401

    def test_invalid_token_returns_401(self, client):
        with patch.object(auth_module.firebase_auth, "verify_id_token", side_effect=ValueError("bad token")):
            resp = client.get("/whoami", headers={"Authorization": "Bearer badtoken"})
        assert resp.status_code == 401

    def test_valid_token_sets_g_and_passes_through(self, client):
        decoded = {"uid": "u1", "email": "u1@example.com", "name": "U One"}
        with patch.object(auth_module.firebase_auth, "verify_id_token", return_value=decoded):
            resp = client.get("/whoami", headers={"Authorization": "Bearer goodtoken"})
        assert resp.status_code == 200
        assert resp.get_json() == {"uid": "u1", "email": "u1@example.com"}


class TestRequireWhitelisted:
    def test_non_whitelisted_email_returns_403(self, client):
        decoded = {"uid": "u1", "email": "notallowed@example.com"}
        fake_db = _FakeWhitelistDb(whitelisted_emails=set())
        with patch.object(auth_module.firebase_auth, "verify_id_token", return_value=decoded), \
             patch.object(auth_module.firestore, "Client", return_value=fake_db):
            resp = client.get("/whitelisted-only", headers={"Authorization": "Bearer t"})
        assert resp.status_code == 403
        assert resp.get_json()["code"] == "NOT_WHITELISTED"

    def test_whitelisted_email_passes_through(self, client):
        decoded = {"uid": "u1", "email": "allowed@example.com"}
        fake_db = _FakeWhitelistDb(whitelisted_emails={"allowed@example.com"})
        with patch.object(auth_module.firebase_auth, "verify_id_token", return_value=decoded), \
             patch.object(auth_module.firestore, "Client", return_value=fake_db):
            resp = client.get("/whitelisted-only", headers={"Authorization": "Bearer t"})
        assert resp.status_code == 200


class _FakeDoc:
    def __init__(self, exists):
        self.exists = exists


class _FakeDocRef:
    def __init__(self, exists):
        self._exists = exists

    def get(self):
        return _FakeDoc(self._exists)


class _FakeCollection:
    def __init__(self, whitelisted_emails):
        self._emails = whitelisted_emails

    def document(self, email):
        return _FakeDocRef(email in self._emails)


class _FakeWhitelistDb:
    """Just enough of firestore.Client to back `whitelist/{email}` lookups in auth.py."""

    def __init__(self, whitelisted_emails):
        self._emails = whitelisted_emails
        auth_module._whitelist_cache.clear()  # tests must not see each other's cached results

    def collection(self, name):
        assert name == "whitelist"
        return _FakeCollection(self._emails)
