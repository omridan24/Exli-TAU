"""
"Merge history" (docs/fx/01-fx-plan.md §6 Decision C), redesigned to merge the EXPENSES, not the balances.

Every expense and recorded payment that is not in the group's merge currency is converted in place:
an expense at the rate of its own date, a payment at the amount-weighted average rate of the expenses in
its currency (so debts that were fully paid in dollars stay fully paid). Each converted document keeps
`original` and `fx` so the conversion is traceable. The group's balances are then DERIVED from all the
expenses and payments, never converted, so totals, stats and "who owes whom" all follow from the documents.

plan_consolidation() writes nothing (it feeds the confirmation screen); apply_plan() writes the document
conversions in chunks. The group-document update (mode, balances) is done by the caller.
"""
from datetime import datetime, timezone

from google.cloud import firestore

from services.groups_service import (
    get_group_or_404,
    ensure_permission,
    log_activity,
    get_currency_settings,
    _group_ledgers,
    _clean_currency,
    ConflictError,
    ValidationError,
    DEFAULT_CURRENCY,
)
from services.group_expenses_service import _scale_shares
import services.fx_service as fx_service
import services.currency_meta as currency_meta

CHUNK = 400  # Firestore batches cap at 500 writes


def _expense_currency(e, group):
    return e.get("currency") or group.get("currency") or DEFAULT_CURRENCY


def plan_consolidation(db, group_ref, group, target):
    """
    Returns {
      "needsConfirm": bool,            # something would change (foreign documents, or the stored balances differ)
      "balances": {uid: minor},        # derived from every expense + payment, in `target`
      "storedBalances": {uid: minor},  # what the group shows today (target-currency ledgers only)
      "details": [per-currency summary], "expenses": [...], "settlements": [...],
    }
    """
    expenses = [(d.id, d.to_dict()) for d in group_ref.collection("expenses").stream()]
    expenses = [(i, e) for i, e in expenses if not e.get("deleted")]
    settlements = [(d.id, d.to_dict()) for d in group_ref.collection("settlements").stream()]
    settlements = [(i, s) for i, s in settlements if not s.get("deleted")]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    tgt_units = currency_meta.get_minor_units(target)
    stats = {}  # currency -> aggregate over its converted expenses
    plan_expenses = []
    balances = {}

    def add(uid, delta):
        balances[uid] = balances.get(uid, 0) + delta

    for expense_id, e in expenses:
        currency = _expense_currency(e, group)
        amount = e["amountMinor"]
        shares = dict(e.get("shares") or {})
        if currency != target:
            result = fx_service.convert_minor(db, amount, currency, target, date_str=e["date"])
            if result["amountMinor"] is None or result["amountMinor"] <= 0:
                raise ConflictError(f"No exchange rate available to convert {currency} to {target} on {e['date']}.")
            new_amount = result["amountMinor"]
            shares = _scale_shares(shares, new_amount)
            st = stats.setdefault(currency, {"src": 0, "tgt": 0, "rates": [], "dates": [], "count": 0})
            st["src"] += amount
            st["tgt"] += new_amount
            st["rates"].append(result["rate"])
            st["dates"].append(e["date"])
            st["count"] += 1
            plan_expenses.append({
                "id": expense_id, "description": e.get("description"), "date": e["date"], "currency": currency,
                "amountMinor": amount, "newAmountMinor": new_amount, "rate": result["rate"],
                "fx": {"rate": result["rate"], "rateDate": result["rateDate"], "basis": result["basis"]},
                "shares": shares,
            })
            amount = new_amount
        add(e["paidBy"], amount)
        for uid, share in shares.items():
            add(uid, -share)

    def ratio_for(currency):
        st = stats.get(currency)
        if st and st["src"]:
            return st["tgt"] / st["src"], None
        units = currency_meta.get_minor_units(currency)
        one = fx_service.convert_minor(db, 10 ** units, currency, target, date_str=today)
        if one["amountMinor"] is None:
            raise ConflictError(f"No exchange rate available to convert {currency} to {target} right now.")
        return one["amountMinor"] / (10 ** units), {"rate": one["rate"], "rateDate": one["rateDate"], "basis": one["basis"]}

    plan_settlements = []
    settled_src = {}
    for settlement_id, s in settlements:
        currency = s.get("currency") or target
        amount = s["amountMinor"]
        if currency != target:
            ratio, fallback_fx = ratio_for(currency)
            new_amount = max(1, round(amount * ratio))
            st = stats.get(currency)
            fx = fallback_fx or {
                "rate": ratio * (10 ** currency_meta.get_minor_units(currency)) / (10 ** tgt_units),
                "rateDate": None, "basis": "weightedAverage",
            }
            plan_settlements.append({
                "id": settlement_id, "from": s["from"], "to": s["to"], "currency": currency,
                "amountMinor": amount, "newAmountMinor": new_amount, "fx": fx,
            })
            settled_src[currency] = settled_src.get(currency, 0) + amount
            amount = new_amount
        add(s["from"], amount)
        add(s["to"], -amount)

    details = []
    for currency, st in stats.items():
        src_units = currency_meta.get_minor_units(currency)
        dates = sorted(st["dates"])
        details.append({
            "currency": currency, "expenseCount": st["count"], "totalMinor": st["src"], "newTotalMinor": st["tgt"],
            "rate": (st["tgt"] / st["src"]) * (10 ** src_units) / (10 ** tgt_units) if st["src"] else 1.0,
            "minRate": min(st["rates"]), "maxRate": max(st["rates"]), "firstDate": dates[0], "lastDate": dates[-1],
            "settlementsMinor": settled_src.get(currency, 0),
        })
    for currency, src in settled_src.items():  # payments in a currency that has no expenses to average over
        if currency not in stats:
            details.append({"currency": currency, "expenseCount": 0, "totalMinor": 0, "newTotalMinor": 0, "rate": 1.0,
                            "minRate": 1.0, "maxRate": 1.0, "firstDate": None, "lastDate": None, "settlementsMinor": src})

    stored = {}
    other_nonzero = False
    for currency, ledger in _group_ledgers(group):
        if currency == target:
            for uid, v in ledger.items():
                stored[uid] = stored.get(uid, 0) + v
        elif any(v != 0 for v in ledger.values()):
            other_nonzero = True
    members = set(balances) | set(stored)
    drift = other_nonzero or any(balances.get(u, 0) != stored.get(u, 0) for u in members)

    return {
        "needsConfirm": bool(plan_expenses or plan_settlements or drift),
        "balances": {u: balances.get(u, 0) for u in members},
        "storedBalances": {u: stored.get(u, 0) for u in members},
        "details": details, "expenses": plan_expenses, "settlements": plan_settlements,
    }


def apply_plan(db, group_ref, plan, uid):
    """Writes the document conversions (chunked, idempotent: a re-run only touches what is still foreign)."""
    jobs = []
    for e in plan["expenses"]:
        jobs.append((group_ref.collection("expenses").document(e["id"]), {
            "amountMinor": e["newAmountMinor"], "currency": plan["target"], "shares": e["shares"],
            "original": {"amountMinor": e["amountMinor"], "currency": e["currency"]}, "fx": e["fx"],
            "updatedAt": firestore.SERVER_TIMESTAMP, "updatedBy": uid,
        }))
    for s in plan["settlements"]:
        jobs.append((group_ref.collection("settlements").document(s["id"]), {
            "amountMinor": s["newAmountMinor"], "currency": plan["target"],
            "original": {"amountMinor": s["amountMinor"], "currency": s["currency"]}, "fx": s["fx"],
        }))
    for i in range(0, len(jobs), CHUNK):
        batch = db.batch()
        for ref, fields in jobs[i:i + CHUNK]:
            batch.update(ref, fields)
        batch.commit()


def _public(plan):
    """The plan as shown to the admin: no per-document internals."""
    return {
        "needsConfirm": plan["needsConfirm"], "balances": plan["balances"], "storedBalances": plan["storedBalances"],
        "details": plan["details"],
        "expenses": [{k: e[k] for k in ("id", "description", "date", "currency", "amountMinor", "newAmountMinor", "rate")}
                     for e in plan["expenses"]],
        "paymentCount": len(plan["settlements"]),
    }


def preview(db, uid, group_id, target_currency):
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "group.update")
    target = _clean_currency(target_currency or DEFAULT_CURRENCY, "currency")
    return _public(plan_consolidation(db, snap.reference, group, target))


def log_merge(db, group_id, uid, plan, target):
    log_activity(db, group_id, "HISTORY_MERGED", uid, metadata={
        "mergeCurrency": target,
        "currencies": [
            {k: d[k] for k in ("currency", "expenseCount", "totalMinor", "newTotalMinor", "rate", "settlementsMinor")}
            for d in plan["details"]
        ],
    })


def consolidate(db, uid, group_id, target_currency):
    """Merge-mode groups only: convert any leftover foreign expenses/payments and re-derive the balances."""
    snap = get_group_or_404(db, group_id)
    group = snap.to_dict()
    ensure_permission(group, uid, "group.update")
    settings = get_currency_settings(group)
    target = _clean_currency(target_currency or settings.get("mergeCurrency") or DEFAULT_CURRENCY, "currency")
    if settings["mode"] != "merge" or settings.get("mergeCurrency") != target:
        raise ValidationError("This only applies to a group that uses one shared currency.")

    plan = plan_consolidation(db, snap.reference, group, target)
    plan["target"] = target
    if not plan["needsConfirm"]:
        return {"converted": 0}
    apply_plan(db, snap.reference, plan, uid)
    snap.reference.update({
        "balances": plan["balances"], "balancesByCurrency": {},
        "lastMergedDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    log_merge(db, group_id, uid, plan, target)
    return {"converted": len(plan["expenses"]) + len(plan["settlements"])}
