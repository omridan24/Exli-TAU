"""
Analytics expense date/month changes. Thin HTTP layer over services/expense_date_service.py.
"""
from flask import Blueprint, request, jsonify, g
from google.cloud import firestore

from config import logger
from utils.auth import require_auth, require_whitelisted
from services import expense_date_service as svc
from services.groups_service import GroupServiceError

expenses_bp = Blueprint("expenses", __name__)


def _run(fn):
    try:
        return jsonify(fn(firestore.Client(), g.uid, request.get_json(silent=True) or {}))
    except GroupServiceError as e:
        return jsonify({"error": e.message, "code": e.code}), e.http_status
    except Exception as e:
        logger.error(f"Expenses API unexpected error: {e}", exc_info=True)
        return jsonify({"error": "Something went wrong.", "code": "INTERNAL_ERROR"}), 500


@expenses_bp.route("/expenses/change-date", methods=["POST"])
@require_auth
@require_whitelisted
def change_date():
    return _run(lambda db, uid, d: svc.change_dates(db, uid, d.get("ids"), d.get("date")))


@expenses_bp.route("/expenses/move-month", methods=["POST"])
@require_auth
@require_whitelisted
def move_month():
    return _run(lambda db, uid, d: svc.move_month(db, uid, d.get("ids"), d.get("month")))


@expenses_bp.route("/expenses/fix-month-mismatch", methods=["POST"])
@require_auth
@require_whitelisted
def fix_month_mismatch():
    return _run(lambda db, uid, d: svc.fix_mismatch(db, uid, d.get("ids")))
