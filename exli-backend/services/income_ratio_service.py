"""
Computes "Split by Income" ratios for a group. See
docs/groups/02-phase2-ui-and-splits-plan.md §3.7 and Debate Q.

This is deliberately the ONE place in the backend that reads across users'
private `users/{uid}/income` data (via the Admin SDK, which is allowed to read
across users, unlike a client bound by Firestore rules — this is the exact
justification for plan 01's "backend writes" model, Debate A). Everything this
module hands back to a caller is a RATIO (integer percent), never a raw net
income figure — see Debate Q on why that boundary matters.

docs/fx/01-fx-plan.md §6: each member's income doc carries its OWN `currency`
(normally everyone's tax-bracket currency, almost always ILS today, but not
guaranteed - see OneTimeIncomeForm). A `reference_currency` is converted onto
before computing ratios, so a USD earner and an ILS earner are never compared
as raw numbers.
"""
import services.fx_service as fx_service


def income_month_key(for_date):
    """'YYYY-MM' of the income month used for an expense dated `for_date`.

    Same-month rule: an expense dated 2026-10-05 uses each participant's 2026-10
    income, and a January expense uses that same year's January income. This is
    what makes the ratio "adapt per month" automatically - no stored weights, no
    admin action. (If the month's income isn't entered yet, callers fall back.)
    """
    return f"{for_date.year}-{for_date.month:02d}"


def _net_income_for_month(db, uid, month_key, reference_currency):
    """Sums `neto` across every users/{uid}/income doc for that month (a person can
    have more than one income source in the same month), converting each doc's
    own currency onto `reference_currency` first (that month's average rate,
    since income only has a month, not an exact date — plan §3 rule 3).
    Returns None if nothing was filled in for that month, the sum was
    zero/negative, or a doc's currency couldn't be converted."""
    docs = db.collection("users").document(uid).collection("income").where("month", "==", month_key).stream()

    total = 0.0
    found = False
    for doc in docs:
        data = doc.to_dict() or {}
        neto = data.get("neto")
        if neto is None:
            continue
        currency = data.get("currency") or reference_currency
        if currency == reference_currency:
            total += float(neto)
        else:
            result = fx_service.convert_amount(db, float(neto), currency, reference_currency, month_str=month_key)
            if result["value"] is None:
                return None  # can't safely compare ratios without a rate for this doc
            total += result["value"]
        found = True

    if not found or total <= 0:
        return None
    return total


def _incomes_to_percent(incomes):
    """Integer percentages summing to EXACTLY 100, largest-remainder method.
    (This is a display/weight value, not money — the final expense split still
    goes through split_engine's own integer-exact rounding on the actual amount.)
    """
    total = sum(incomes.values())
    exact = {uid: (net * 100) / total for uid, net in incomes.items()}
    floors = {uid: int(v) for uid, v in exact.items()}
    remainder = 100 - sum(floors.values())

    order = sorted(incomes.keys(), key=lambda uid: (-(exact[uid] - floors[uid]), uid))
    for uid in order[:remainder]:
        floors[uid] += 1

    return floors


def get_income_ratios(db, group, for_date, reference_currency="ILS"):
    """
    group: dict with at least a "members" map.
    for_date: a date/datetime — usually the expense's own date, or today for a
              picker preview before an expense exists yet.
    reference_currency: the currency every member's income is converted onto
              before computing ratios (docs/fx/01-fx-plan.md §6) — the
              expense's own canonical currency when called from
              group_expenses_service, or the group's mergeCurrency for a
              picker preview with no expense yet.

    Returns:
      {
        "month": "YYYY-MM",            # the income month used (for_date's own month)
        "ready": bool,
        "missing": [uid, ...],         # active members with no usable income for that month
        "ratios": {uid: int} | None,   # integer percents summing to 100; None unless ready
      }
    """
    month_key = income_month_key(for_date)
    active_uids = sorted(
        uid for uid, m in (group.get("members") or {}).items() if m.get("status") == "active"
    )

    incomes = {}
    missing = []
    for uid in active_uids:
        net = _net_income_for_month(db, uid, month_key, reference_currency)
        if net is None:
            missing.append(uid)
        else:
            incomes[uid] = net

    if missing:
        return {"month": month_key, "ready": False, "missing": missing, "ratios": None}

    return {"month": month_key, "ready": True, "missing": [], "ratios": _incomes_to_percent(incomes)}
