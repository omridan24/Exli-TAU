"""
Groups HTTP layer (Phase 1 & 2). Thin by design: parse the request, call
services/groups_service.py, translate its typed errors into HTTP responses.
No business logic lives here — see groups_service.py and docs/groups/*.md.
"""
from datetime import date, datetime

from flask import Blueprint, request, jsonify, g
from google.cloud import firestore
from werkzeug.exceptions import HTTPException

from config import Config, logger
from extensions import limiter
from utils.auth import require_auth, require_whitelisted
from services import groups_service as svc
from services import group_expenses_service as expenses_svc
from services import group_settlements_service as settle_svc
from services import group_currency_merge_service as merge_svc
from services import group_image_service as image_svc

groups_bp = Blueprint("groups", __name__)


def _db():
    # Matches the pattern used elsewhere in the backend (e.g. quota_service, main.py):
    # a fresh client per call. The Firestore Python client is safe to construct
    # repeatedly and pools connections internally.
    return firestore.Client()


def _user_info():
    return {
        "uid": g.uid,
        "email": g.email,
        "displayName": g.display_name,
        "photoURL": g.photo_url,
    }


def _handled(fn):
    """Runs a service call and converts its typed errors into the matching HTTP response."""
    try:
        return fn()
    except svc.GroupServiceError as e:
        logger.info(f"Groups API [{e.code}]: {e.message}")
        return jsonify({"error": e.message, "code": e.code}), e.http_status
    except HTTPException as e:
        # utils.security.validate_file_safety (used by group_image_service) calls
        # Flask's abort() directly rather than raising a typed GroupServiceError —
        # pass its real status/description through instead of masking it as a 500.
        return jsonify({"error": e.description, "code": "INVALID_FILE"}), e.code
    except Exception as e:
        logger.error(f"Groups API unexpected error: {e}", exc_info=True)
        return jsonify({"error": "Something went wrong.", "code": "INTERNAL_ERROR"}), 500


# --- Group CRUD ---

@groups_bp.route("/groups", methods=["POST"])
@require_auth
@require_whitelisted
def create_group():
    data = request.get_json(silent=True) or {}

    def run():
        group_id = svc.create_group(
            _db(), g.uid, _user_info(),
            name=data.get("name"),
            description=data.get("description"),
            currency_mode=data.get("currencyMode", "merge"),
            merge_currency=data.get("mergeCurrency", "ILS"),
            emoji=data.get("emoji"),
            group_type=data.get("type", "other"),
        )
        return jsonify({"groupId": group_id}), 201

    return _handled(run)


@groups_bp.route("/groups/<group_id>", methods=["PATCH"])
@require_auth
@require_whitelisted
def update_group(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        svc.update_group(_db(), g.uid, group_id, data)
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>", methods=["DELETE"])
@require_auth
@require_whitelisted
def delete_group(group_id):
    def run():
        svc.delete_group(_db(), g.uid, group_id)
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/image", methods=["POST"])
@require_auth
@require_whitelisted
def upload_group_image(group_id):
    file_storage = request.files.get("image")

    def run():
        if not file_storage:
            raise svc.ValidationError("No image file provided.")
        image_url = image_svc.upload_group_image(_db(), g.uid, group_id, file_storage)
        return jsonify({"imageUrl": image_url})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/split-rules", methods=["PUT"])
@require_auth
@require_whitelisted
def set_split_rules(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        svc.set_split_rules(_db(), g.uid, group_id, data.get("rules") or [], data.get("defaultSplitRuleId"))
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/income-ratios", methods=["GET"])
@require_auth
@require_whitelisted
def income_ratio_months(group_id):
    months = [m for m in (request.args.get("months") or "").split(",") if m]

    def run():
        return jsonify({"months": svc.get_income_ratio_months(_db(), g.uid, group_id, months)})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/income-ratio", methods=["GET"])
@require_auth
@require_whitelisted
def income_ratio_preview(group_id):
    raw_date = request.args.get("date")
    currency = request.args.get("currency")

    def run():
        try:
            for_date = datetime.strptime(raw_date, "%Y-%m-%d").date() if raw_date else date.today()
        except ValueError:
            raise svc.ValidationError("date must be in YYYY-MM-DD format.")
        return jsonify(svc.get_income_ratio_preview(_db(), g.uid, group_id, for_date, reference_currency=currency))

    return _handled(run)


# --- Invites ---

@groups_bp.route("/groups/<group_id>/invite", methods=["POST"])
@require_auth
@require_whitelisted
def create_invite(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        return jsonify(svc.get_or_create_invite(_db(), g.uid, group_id, expires_in_days=data.get("expiresInDays")))

    return _handled(run)


@groups_bp.route("/groups/<group_id>/invite/rotate", methods=["POST"])
@require_auth
@require_whitelisted
def rotate_invite(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        return jsonify(svc.rotate_invite(_db(), g.uid, group_id, expires_in_days=data.get("expiresInDays")))

    return _handled(run)


@groups_bp.route("/groups/<group_id>/invite", methods=["DELETE"])
@require_auth
@require_whitelisted
def revoke_invite(group_id):
    def run():
        svc.revoke_invite(_db(), g.uid, group_id)
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/invites/<token>", methods=["GET"])
@limiter.limit(Config.RATE_LIMIT_GROUP_INVITES)
@require_auth
def invite_preview(token):
    def run():
        return jsonify(svc.get_invite_preview(_db(), g.uid, g.email, token))

    return _handled(run)


@groups_bp.route("/invites/<token>/request", methods=["POST"])
@limiter.limit(Config.RATE_LIMIT_GROUP_INVITES)
@require_auth
@require_whitelisted
def request_to_join(token):
    def run():
        return jsonify(svc.create_join_request(_db(), g.uid, _user_info(), token)), 201

    return _handled(run)


@groups_bp.route("/invites/<token>/request", methods=["DELETE"])
@limiter.limit(Config.RATE_LIMIT_GROUP_INVITES)
@require_auth
def cancel_request(token):
    def run():
        svc.cancel_join_request(_db(), g.uid, token)
        return jsonify({"status": "ok"})

    return _handled(run)


# --- Join request decisions (admin) ---

@groups_bp.route("/groups/<group_id>/requests/<target_uid>/approve", methods=["POST"])
@require_auth
@require_whitelisted
def approve_request(group_id, target_uid):
    def run():
        svc.approve_request(_db(), g.uid, group_id, target_uid)
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/requests/<target_uid>/reject", methods=["POST"])
@require_auth
@require_whitelisted
def reject_request(group_id, target_uid):
    def run():
        svc.reject_request(_db(), g.uid, group_id, target_uid)
        return jsonify({"status": "ok"})

    return _handled(run)


# --- Membership management ---

@groups_bp.route("/groups/<group_id>/members/<target_uid>", methods=["PATCH"])
@require_auth
@require_whitelisted
def update_member(group_id, target_uid):
    data = request.get_json(silent=True) or {}

    def run():
        svc.change_role(_db(), g.uid, group_id, target_uid, data.get("role"))
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/members/<target_uid>", methods=["DELETE"])
@require_auth
@require_whitelisted
def remove_member(group_id, target_uid):
    """Admin removing someone, OR a member leaving on their own (target_uid == caller)."""
    def run():
        svc.remove_member(_db(), g.uid, group_id, target_uid)
        return jsonify({"status": "ok"})

    return _handled(run)


# --- Expenses ---

def _expense_kwargs_from_body(data):
    """Maps the request's camelCase JSON body onto group_expenses_service's kwargs."""
    return {
        "description": data.get("description"),
        "amount_minor": data.get("amountMinor"),
        "currency": data.get("currency", "ILS"),
        "date_str": data.get("date"),
        "category": data.get("category"),
        "payer_id": data.get("payerId"),
        "participants": data.get("participants"),
        "split_input": data.get("split"),  # {"splitRuleId": "..."} or {"kind": "custom", "params": {...}}
        "note": data.get("note"),
    }


@groups_bp.route("/groups/<group_id>/expenses", methods=["POST"])
@require_auth
@require_whitelisted
def create_expense(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        expense_id = expenses_svc.create_expense(_db(), g.uid, group_id, **_expense_kwargs_from_body(data))
        return jsonify({"expenseId": expense_id}), 201

    return _handled(run)


@groups_bp.route("/groups/<group_id>/expenses/apply-default-split", methods=["POST"])
@require_auth
@require_whitelisted
def apply_default_split(group_id):
    def run():
        return jsonify(expenses_svc.apply_default_split_to_existing(_db(), g.uid, group_id))

    return _handled(run)


@groups_bp.route("/groups/<group_id>/expenses/from-personal", methods=["POST"])
@require_auth
@require_whitelisted
def transfer_personal_expense(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        result = expenses_svc.transfer_personal_expense(
            _db(), g.uid, group_id, data.get("personalExpenseId"), data.get("split") or {}
        )
        return jsonify(result), 201

    return _handled(run)


@groups_bp.route("/groups/<group_id>/expenses/from-personal/batch", methods=["POST"])
@require_auth
@require_whitelisted
def transfer_personal_expenses_batch(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        result = expenses_svc.transfer_personal_expenses_batch(
            _db(), g.uid, group_id, data.get("personalExpenseIds") or [], data.get("splitRuleId"),
            use_default=bool(data.get("useDefault")),
        )
        return jsonify(result)

    return _handled(run)


@groups_bp.route("/groups/<group_id>/expenses/from-personal/<personal_expense_id>", methods=["DELETE"])
@require_auth
@require_whitelisted
def remove_personal_expense_from_group(group_id, personal_expense_id):
    def run():
        expenses_svc.remove_personal_expense_from_group(_db(), g.uid, group_id, personal_expense_id)
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/expenses/<expense_id>", methods=["PATCH"])
@require_auth
@require_whitelisted
def edit_expense(group_id, expense_id):
    data = request.get_json(silent=True) or {}

    def run():
        expenses_svc.edit_expense(_db(), g.uid, group_id, expense_id, **_expense_kwargs_from_body(data))
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/expenses/<expense_id>/convert", methods=["POST"])
@require_auth
@require_whitelisted
def convert_expense(group_id, expense_id):
    data = request.get_json(silent=True) or {}

    def run():
        expenses_svc.convert_expense(_db(), g.uid, group_id, expense_id, data.get("toCurrency"))
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/merge-preview", methods=["GET"])
@require_auth
@require_whitelisted
def merge_preview(group_id):
    def run():
        return jsonify(merge_svc.preview(_db(), g.uid, group_id, request.args.get("currency")))

    return _handled(run)


@groups_bp.route("/groups/<group_id>/consolidate-currency", methods=["POST"])
@require_auth
@require_whitelisted
def consolidate_currency(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        return jsonify(merge_svc.consolidate(_db(), g.uid, group_id, data.get("currency")))

    return _handled(run)


@groups_bp.route("/groups/<group_id>/settlements", methods=["POST"])
@require_auth
@require_whitelisted
def record_settlement(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        settlement_id = settle_svc.record_settlement(
            _db(), g.uid, group_id,
            from_uid=data.get("from"), to_uid=data.get("to"), amount_minor=data.get("amountMinor"),
            currency=data.get("currency"), method=data.get("method"), note=data.get("note"),
        )
        return jsonify({"id": settlement_id}), 201

    return _handled(run)


@groups_bp.route("/groups/<group_id>/settlements/<settlement_id>", methods=["DELETE"])
@require_auth
@require_whitelisted
def delete_settlement(group_id, settlement_id):
    def run():
        settle_svc.delete_settlement(_db(), g.uid, group_id, settlement_id)
        return jsonify({"status": "ok"})

    return _handled(run)


@groups_bp.route("/groups/<group_id>/me/payment-handles", methods=["PUT"])
@require_auth
@require_whitelisted
def set_payment_handles(group_id):
    data = request.get_json(silent=True) or {}

    def run():
        return jsonify(settle_svc.set_payment_handles(_db(), g.uid, group_id, data))

    return _handled(run)


@groups_bp.route("/groups/<group_id>/expenses/<expense_id>", methods=["DELETE"])
@require_auth
@require_whitelisted
def delete_expense(group_id, expense_id):
    def run():
        expenses_svc.delete_expense(_db(), g.uid, group_id, expense_id)
        return jsonify({"status": "ok"})

    return _handled(run)
