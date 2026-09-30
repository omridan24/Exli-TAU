"""
Group types and the built-in split-rule catalog. See
docs/groups/02-phase2-ui-and-splits-plan.md §2 (types), §3.2 (catalog), §3.7
(Split by Income). Display names/emoji live in the frontend's i18n files
(public/locales/*/translation.json under "groups") — this module only holds the
IDs, kinds, and per-type defaults the backend needs to validate and seed.
"""

MAX_MEMBERS = 100  # overall cap from Phase 1 (plan 01), still applies to every type

GROUP_TYPES = {
    "partner": {"maxMembers": 2},
    "household": {"maxMembers": None},
    "trip": {"maxMembers": None},
    "friends": {"maxMembers": None},
    "other": {"maxMembers": None},
}

# id -> { kind, emoji }. The id is also the stable splitRule id/`builtIn` key for a
# freshly-seeded group; an admin can rename a built-in's *display* name later, but
# not its kind (see validate_split_rules below).
BUILT_IN_RULES = {
    "equality_first": {"kind": "equal", "emoji": "⚖️"},
    "love_but_i_pay": {"kind": "payer_covers", "emoji": "❤️"},
    "youre_paying": {"kind": "payer_covers", "emoji": "😘"},  # mirror of love_but_i_pay: same kind, partner's perspective
    "your_treat": {"kind": "others_cover", "emoji": "🎁"},  # 2-person only — enforced in group_expenses_service._resolve_split
    "this_rounds_on_me": {"kind": "payer_covers", "emoji": "🍻"},  # same kind as love_but_i_pay, distinct fixed name
    "family_pack": {"kind": "shares", "emoji": "👨‍👩‍👧"},
    "fair_share": {"kind": "percent", "emoji": "📐"},
    "split_by_income": {"kind": "income_ratio", "emoji": "💼"},
}

# Which built-ins each type starts with, and which is pre-selected as the default.
TYPE_TEMPLATES = {
    "partner": {"builtIns": ["equality_first", "love_but_i_pay", "youre_paying", "split_by_income"], "default": "equality_first"},
    "household": {"builtIns": ["equality_first", "love_but_i_pay", "youre_paying", "split_by_income"], "default": "equality_first"},
    "trip": {"builtIns": ["equality_first", "family_pack", "love_but_i_pay", "split_by_income"], "default": "equality_first"},
    "friends": {"builtIns": ["equality_first", "this_rounds_on_me", "split_by_income"], "default": "equality_first"},
    "other": {"builtIns": ["equality_first", "love_but_i_pay", "split_by_income"], "default": "equality_first"},
}

# What kind an admin-CREATED (non-built-in) rule may use. income_ratio and custom
# are deliberately excluded: income_ratio only exists as the split_by_income
# built-in (it needs no admin-set params), and "custom"/Pour It Yourself is never
# a stored rule at all (plan §3.1).
ADMIN_CREATABLE_KINDS = {"equal", "shares", "percent", "payer_covers", "others_cover"}

MAX_SPLIT_RULES = 20


def is_valid_type(group_type):
    return group_type in GROUP_TYPES


def max_members_for_type(group_type):
    """None means "use the overall MAX_MEMBERS cap, no extra per-type limit"."""
    return GROUP_TYPES.get(group_type, {}).get("maxMembers")


def effective_max_members(group_type):
    type_cap = max_members_for_type(group_type)
    return min(MAX_MEMBERS, type_cap) if type_cap is not None else MAX_MEMBERS


def build_default_split_rules(group_type):
    """Returns (rules: list[dict], default_split_rule_id: str) seeded on group creation."""
    template = TYPE_TEMPLATES.get(group_type, TYPE_TEMPLATES["other"])
    rules = [_seed_rule(builtin_key) for builtin_key in template["builtIns"]]
    return rules, template["default"]


def _seed_rule(builtin_key):
    catalog_entry = BUILT_IN_RULES[builtin_key]
    return {
        "id": builtin_key,
        "builtIn": builtin_key,
        "name": None,  # None = use the catalog's translated name client-side
        "emoji": catalog_entry["emoji"],
        "kind": catalog_entry["kind"],
        "params": {},
        "hidden": False,
        "needsReview": False,
    }


class SplitRuleValidationError(ValueError):
    pass


def validate_split_rules(rules):
    """
    Validates a full split-rules array (as sent to PUT /groups/<gid>/split-rules).
    Raises SplitRuleValidationError with a human-readable message. Returns the set
    of valid rule ids, so the caller can also check defaultSplitRuleId is among them.
    """
    if not isinstance(rules, list) or not rules:
        raise SplitRuleValidationError("At least one split rule is required.")
    if len(rules) > MAX_SPLIT_RULES:
        raise SplitRuleValidationError(f"A group can have at most {MAX_SPLIT_RULES} split rules.")

    seen_ids = set()
    visible_count = 0

    for rule in rules:
        rule_id = rule.get("id") if isinstance(rule, dict) else None
        if not rule_id or rule_id in seen_ids:
            raise SplitRuleValidationError("Each split rule needs a unique id.")
        seen_ids.add(rule_id)

        builtin_key = rule.get("builtIn")
        kind = rule.get("kind")

        if builtin_key:
            if builtin_key not in BUILT_IN_RULES:
                raise SplitRuleValidationError(f"Unknown built-in rule: {builtin_key}")
            expected_kind = BUILT_IN_RULES[builtin_key]["kind"]
            if kind != expected_kind:
                raise SplitRuleValidationError(f"Built-in rule '{builtin_key}' must keep kind '{expected_kind}'.")
        else:
            if kind not in ADMIN_CREATABLE_KINDS:
                raise SplitRuleValidationError(f"Custom rules must use one of: {sorted(ADMIN_CREATABLE_KINDS)}")
            if not (rule.get("name") or "").strip():
                raise SplitRuleValidationError("Custom rules need a name.")

        _validate_rule_params(kind, rule.get("params") or {})

        if not rule.get("hidden"):
            visible_count += 1

    if visible_count == 0:
        raise SplitRuleValidationError("At least one split rule must stay visible.")

    return seen_ids


def _validate_rule_params(kind, params):
    if kind not in ("shares", "percent"):
        return

    weights = params.get("weights") or {}
    if not weights:
        return  # allowed to be unset until the admin configures it (rule stays needsReview)

    for uid, weight in weights.items():
        if not isinstance(weight, int) or weight < 0:
            raise SplitRuleValidationError("Split weights must be non-negative whole numbers.")

    if kind == "percent" and sum(weights.values()) not in (0, 100):
        raise SplitRuleValidationError("Percent weights must sum to 100.")
