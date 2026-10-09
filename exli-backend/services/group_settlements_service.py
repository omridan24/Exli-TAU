"""
Settle-ups: a member records that they paid someone back (or that they received a payment).

A settlement is a ledger entry like an expense, but it only moves balances between two people:
the payer's balance goes UP by the amount (they owe less) and the receiver's goes DOWN (they are
owed less), so the zero-sum invariant holds. It is written in the same transaction as the balance
update, logged to the group's activity feed, and can be undone (soft-deleted + reversed).

Also holds each member's payment handles (phone for Bit/PayBox, Venmo, PayPal.me) so the app can
open the right app with the amount prefilled. Handles are stored on the group's member entry,
which every member can already read.
"""
import re

from google.cloud import firestore

from services.groups_service import (
    get_group_or_404,
    active_role,
    log_activity,
    get_currency_settings,
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
)
from services.group_expenses_service import (
    _apply_balance_updates,
    _negate,
)
import services.currency_meta as currency_meta

PAYMENT_METHODS = {"bit", "paybox", "venmo", "paypal", "cash", "other"}
MAX_NOTE_LEN = 140


def _settlement_deltas(from_uid, to_uid, amount_minor):
    return {from_uid: amount_minor, to_uid: -amount_minor}


def _ledger_for(group, currency):
    """Which stored ledger a settlement in `currency` moves: ('flat', balances) or ('bucket', balances)."""
    settings = get_currency_settings(group)
    if settings["mode"] != "keep_original":
        return "flat", dict(group.get("balances") or {}), settings.get("mergeCurrency") or group.get("currency") or "ILS"

    by_currency = group.get("balancesByCurrency") or {}
    if currency in by_currency:
        return "bucket", dict(by_currency[currency] or {}), currency
    legacy_currency = group.get("currency") or "ILS"
    flat = group.get("balances") or {}
    if currency == legacy_currency and any(v != 0 for v in flat.values()):
        return "flat", dict(flat), currency  # history from before a merge -> keep_original switch
    raise ValidationError(f"This group has no {currency} balances to settle.")


def _validate_against_balances(group, from_uid, to_uid, amount_minor, currency):
    _, balances, resolved_currency = _ledger_for(group, currency)
    owed_by_payer = -balances.get(from_uid, 0)
    owed_to_receiver = balances.get(to_uid, 0)
    if owed_by_payer <= 0:
        raise ConflictError("That member doesn't owe anything right now.")
    if owed_to_receiver <= 0:
        raise ConflictError("That member isn't owed anything right now.")
    if amount_minor > owed_by_payer or amount_minor > owed_to_receiver:
        raise ConflictError("That is more than is owed.")
    return resolved_currency


def _delta_entries(group, currency, deltas):
    """(currency, deltas) entries in the shape _apply_balance_updates expects, routed to the right ledger."""
    settings = get_currency_settings(group)
    kind, _, resolved = _ledger_for(group, currency)
    if kind == "flat" and settings["mode"] == "keep_original":
        # Legacy flat ledger inside a keep_original group: write it directly.
        balances = dict(group.get("balances") or {})
        for uid, delta in deltas.items():
            balances[uid] = balances.get(uid, 0) + delta
        return {"balances": balances}
    return _apply_balance_updates(group, settings, [(resolved, deltas)])


@firestore.transactional
def _record_txn(transaction, group_ref, settlement_ref, from_uid, to_uid, amount_minor, currency, doc_fields):
    snap = group_ref.get(transaction=transaction)
    if not snap.exists:
        raise NotFoundError("Group not found.")
    group = snap.to_dict()
    resolved = _validate_against_balances(group, from_uid, to_uid, amount_minor, currency)
    updates = _delta_entries(group, currency, _settlement_deltas(from_uid, to_uid, amount_minor))
    transaction.set(settlement_ref, {**doc_fields, "currency": resolved})
    transaction.update(group_ref, {**updates, "updatedAt": firestore.SERVER_TIMESTAMP})
    return resolved


@firestore.transactional
def _delete_txn(transaction, group_ref, settlement_ref, deleter_uid):
    snap = group_ref.get(transaction=transaction)
    if not snap.exists:
        raise NotFoundError("Group not found.")
    group = snap.to_dict()
    settlement = settlement_ref.get(transaction=transaction)
    if not settlement.exists or settlement.to_dict().get("deleted"):
        raise NotFoundError("Payment not found.")
    s = settlement.to_dict()
    updates = _delta_entries(group, s["currency"], _negate(_settlement_deltas(s["from"], s["to"], s["amountMinor"])))
    transaction.update(settlement_ref, {
        "deleted": True, "deletedBy": deleter_uid, "deletedAt": firestore.SERVER_TIMESTAMP,
    })
    transaction.update(group_ref, {**updates, "updatedAt": firestore.SERVER_TIMESTAMP})


def record_settlement(db, uid, group_id, *, from_uid, to_uid, amount_minor, currency=None, method=None, note=None):
    """The payer, the receiver or an admin can record a payment."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    role = active_role(group, uid)
    if role is None:
        raise ForbiddenError("You are not a member of this group.")
    if uid not in (from_uid, to_uid) and role != "admin":
        raise ForbiddenError("Only the people involved, or an admin, can record this payment.")

    if from_uid == to_uid:
        raise ValidationError("A payment needs two different people.")
    for member in (from_uid, to_uid):
        if active_role(group, member) is None:
            raise ValidationError("Both people must be active members of this group.")
    if not isinstance(amount_minor, int) or isinstance(amount_minor, bool) or amount_minor <= 0:
        raise ValidationError("Amount must be a positive whole number of minor currency units.")

    method = (method or "other").strip().lower()
    if method not in PAYMENT_METHODS:
        raise ValidationError(f"Unknown payment method: {method}")
    note = (note or "").strip() or None
    if note and len(note) > MAX_NOTE_LEN:
        raise ValidationError(f"Note must be at most {MAX_NOTE_LEN} characters.")

    settings = get_currency_settings(group)
    if settings["mode"] == "keep_original":
        currency = (currency or "").strip().upper()
        if currency not in currency_meta.supported_currencies():
            raise ValidationError("A currency is required to settle in this group.")
    else:
        currency = settings.get("mergeCurrency") or group.get("currency") or "ILS"

    settlement_ref = snap.reference.collection("settlements").document()
    fields = {
        "from": from_uid, "to": to_uid, "amountMinor": amount_minor, "method": method, "note": note,
        "createdBy": uid, "createdAt": firestore.SERVER_TIMESTAMP, "deleted": False,
    }
    transaction = db.transaction()
    resolved = _record_txn(transaction, snap.reference, settlement_ref, from_uid, to_uid, amount_minor, currency, fields)
    log_activity(db, group_id, "SETTLEMENT_RECORDED", uid, target_id=settlement_ref.id,
                 metadata={"from": from_uid, "to": to_uid, "amountMinor": amount_minor, "currency": resolved})
    return settlement_ref.id


def delete_settlement(db, uid, group_id, settlement_id):
    """Undo a recorded payment: whoever recorded it, or an admin."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    role = active_role(group, uid)
    if role is None:
        raise ForbiddenError("You are not a member of this group.")
    settlement_ref = snap.reference.collection("settlements").document(settlement_id)
    existing = settlement_ref.get()
    if not existing.exists or existing.to_dict().get("deleted"):
        raise NotFoundError("Payment not found.")
    if existing.to_dict().get("createdBy") != uid and role != "admin":
        raise ForbiddenError("Only the person who recorded this payment, or an admin, can undo it.")

    _delete_txn(db.transaction(), snap.reference, settlement_ref, uid)
    log_activity(db, group_id, "SETTLEMENT_DELETED", uid, target_id=settlement_id)
    return True


# --- Payment handles -------------------------------------------------------

_PHONE_RE = re.compile(r"^\+?[0-9][0-9\-\s]{6,18}$")
_HANDLE_RE = re.compile(r"^[A-Za-z0-9_.\-]{1,40}$")


def set_payment_handles(db, uid, group_id, handles):
    """A member sets their own handles (any may be blank). Stored on their member entry in the group."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    if active_role(group, uid) is None:
        raise ForbiddenError("You are not a member of this group.")

    handles = handles or {}
    cleaned = {}
    phone = (handles.get("phone") or "").strip()
    if phone:
        if not _PHONE_RE.match(phone):
            raise ValidationError("That phone number doesn't look right.")
        cleaned["phone"] = phone
    for key in ("venmo", "paypal"):
        value = (handles.get(key) or "").strip().lstrip("@")
        if value:
            if not _HANDLE_RE.match(value):
                raise ValidationError(f"That {key} username doesn't look right.")
            cleaned[key] = value

    snap.reference.update({f"members.{uid}.paymentHandles": cleaned or None})
    return cleaned
