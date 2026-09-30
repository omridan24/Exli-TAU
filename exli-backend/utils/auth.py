"""
Firebase ID token authentication for endpoints that manage shared data (e.g. Groups).

Existing endpoints in main.py trust a `userId` passed in the request body/URL without
verifying it. That's an acceptable-for-now gap for private per-user data (Firestore
rules still protect it), but it's not acceptable once a request can act on OTHER
people's data (approve a join request, remove a member, etc). Those endpoints must
use @require_auth (and usually @require_whitelisted) instead of trusting the body.
"""
import time
import functools
import firebase_admin
from firebase_admin import auth as firebase_auth
from flask import request, g, jsonify
from google.cloud import firestore
from config import logger

# --- Firebase Admin init ---
# On Cloud Run this uses the attached service account (Application Default Credentials),
# same as the existing `firestore.Client()` calls elsewhere in the backend.
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app()


def _unauthorized(message):
    resp = jsonify({"error": message, "code": "UNAUTHENTICATED"})
    resp.status_code = 401
    return resp


def require_auth(fn):
    """
    Verifies the Firebase ID token in the `Authorization: Bearer <token>` header.
    On success, sets:
      g.uid          - Firebase auth uid (the ONLY trusted identity for the request)
      g.email        - token email
      g.display_name - token name, if present
      g.photo_url    - token picture, if present
    On failure, returns 401 (never falls through to the view).
    """
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return _unauthorized("Missing Authorization header")

        id_token = header[len("Bearer "):].strip()
        if not id_token:
            return _unauthorized("Missing bearer token")

        try:
            decoded = firebase_auth.verify_id_token(id_token)
        except firebase_auth.ExpiredIdTokenError:
            return _unauthorized("Token expired")
        except firebase_auth.RevokedIdTokenError:
            return _unauthorized("Token revoked")
        except Exception as e:
            logger.warning(f"ID token verification failed: {e}")
            return _unauthorized("Invalid token")

        g.uid = decoded["uid"]
        g.email = decoded.get("email")
        g.display_name = decoded.get("name") or (g.email.split("@")[0] if g.email else "User")
        g.photo_url = decoded.get("picture")

        return fn(*args, **kwargs)

    return wrapper


# --- Whitelist check ---
# Small in-memory TTL cache so a burst of requests from one user doesn't hit
# Firestore for the same whitelist doc repeatedly. Fine for a single Cloud Run
# instance; worst case on scale-out is a few extra reads, not a correctness issue.
_WHITELIST_CACHE_TTL_SECONDS = 120
_whitelist_cache = {}  # email -> (is_whitelisted: bool, checked_at: float)


def _is_whitelisted(db, email):
    if not email:
        return False

    cached = _whitelist_cache.get(email)
    now = time.time()
    if cached and (now - cached[1]) < _WHITELIST_CACHE_TTL_SECONDS:
        return cached[0]

    exists = db.collection("whitelist").document(email).get().exists
    _whitelist_cache[email] = (exists, now)
    return exists


def require_whitelisted(fn):
    """
    Stacks on top of @require_auth (must be applied AFTER it, i.e. listed BELOW it
    in decorator order, so g.email is already set). Returns 403 NOT_WHITELISTED if
    the user's email isn't in the `whitelist` collection - matching the app-wide
    access gate already enforced client-side in App.jsx.
    """
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        db = firestore.Client()
        if not _is_whitelisted(db, getattr(g, "email", None)):
            resp = jsonify({
                "error": "This email is not yet approved to use Exli.",
                "code": "NOT_WHITELISTED",
            })
            resp.status_code = 403
            return resp
        return fn(*args, **kwargs)

    return wrapper
