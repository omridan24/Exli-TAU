"""
Computes "Split by Income" ratios for a group. See
docs/groups/02-phase2-ui-and-splits-plan.md §3.7 and Debate Q.

This is deliberately the ONE place in the backend that reads across users'
private `users/{uid}/income` data (via the Admin SDK, which is allowed to read
across users, unlike a client bound by Firestore rules — this is the exact
justification for plan 01's "backend writes" model, Debate A). Everything this
module hands back to a caller is a RATIO (integer percent), never a raw net
income figure — see Debate Q on why that boundary matters.
"""


def previous_month_key(for_date):
    """'YYYY-MM' for the calendar month right before `for_date`'s month.

    The plan's own wording: an expense uses "last month's" income, so a January
    expense uses December's income, an expense dated 2026-10-05 uses 2026-09, etc.
    This is also what makes the ratio "adapt per month" automatically — no stored
    weights, no admin action, just whichever month is now complete.
    """
    year, month = for_date.year, for_date.month
    if month == 1:
        return f"{year - 1}-12"
    return f"{year}-{month - 1:02d}"


def _net_income_for_month(db, uid, month_key):
    """Sums `neto` across every users/{uid}/income doc for that month (a person can
    have more than one income source in the same month). Returns None if nothing
    was filled in for that month, or the sum was zero/negative."""
    docs = db.collection("users").document(uid).collection("income").where("month", "==", month_key).stream()

    total = 0.0
    found = False
    for doc in docs:
        neto = (doc.to_dict() or {}).get("neto")
        if neto is not None:
            total += float(neto)
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


def get_income_ratios(db, group, for_date):
    """
    group: dict with at least a "members" map.
    for_date: a date/datetime — usually the expense's own date, or today for a
              picker preview before an expense exists yet.

    Returns:
      {
        "month": "YYYY-MM",            # the month actually used (for_date's month, minus one)
        "ready": bool,
        "missing": [uid, ...],         # active members with no usable income for that month
        "ratios": {uid: int} | None,   # integer percents summing to 100; None unless ready
      }
    """
    month_key = previous_month_key(for_date)
    active_uids = sorted(
        uid for uid, m in (group.get("members") or {}).items() if m.get("status") == "active"
    )

    incomes = {}
    missing = []
    for uid in active_uids:
        net = _net_income_for_month(db, uid, month_key)
        if net is None:
            missing.append(uid)
        else:
            incomes[uid] = net

    if missing:
        return {"month": month_key, "ready": False, "missing": missing, "ratios": None}

    return {"month": month_key, "ready": True, "missing": [], "ratios": _incomes_to_percent(incomes)}
