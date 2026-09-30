import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.split_catalog as catalog


class TestTypesAndCaps:
    def test_partner_is_capped_at_two(self):
        assert catalog.effective_max_members("partner") == 2

    def test_other_types_use_overall_cap(self):
        for t in ("household", "trip", "friends", "other"):
            assert catalog.effective_max_members(t) == catalog.MAX_MEMBERS

    def test_is_valid_type(self):
        assert catalog.is_valid_type("partner")
        assert not catalog.is_valid_type("not_a_type")


class TestDefaultSplitRules:
    @pytest.mark.parametrize("group_type", ["partner", "household", "trip", "friends", "other"])
    def test_every_type_seeds_at_least_two_rules_with_a_valid_default(self, group_type):
        rules, default_id = catalog.build_default_split_rules(group_type)
        assert len(rules) >= 2
        ids = {r["id"] for r in rules}
        assert default_id in ids

    def test_every_type_includes_split_by_income(self):
        for group_type in ("partner", "household", "trip", "friends", "other"):
            rules, _ = catalog.build_default_split_rules(group_type)
            assert any(r["builtIn"] == "split_by_income" for r in rules)

    def test_partner_and_household_include_youre_paying(self):
        for group_type in ("partner", "household"):
            rules, _ = catalog.build_default_split_rules(group_type)
            assert any(r["builtIn"] == "youre_paying" for r in rules)

    def test_seeded_rules_are_visible_and_not_needing_review(self):
        rules, _ = catalog.build_default_split_rules("household")
        for rule in rules:
            assert rule["hidden"] is False
            assert rule["needsReview"] is False

    def test_unknown_type_falls_back_to_other_template(self):
        rules, default_id = catalog.build_default_split_rules("not_a_type")
        other_rules, other_default = catalog.build_default_split_rules("other")
        assert {r["id"] for r in rules} == {r["id"] for r in other_rules}
        assert default_id == other_default


class TestValidateSplitRules:
    def _minimal_rules(self):
        rules, _ = catalog.build_default_split_rules("household")
        return rules

    def test_valid_seeded_rules_pass(self):
        catalog.validate_split_rules(self._minimal_rules())  # no raise

    def test_empty_list_rejected(self):
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules([])

    def test_too_many_rules_rejected(self):
        rules = [
            {"id": f"r{i}", "builtIn": None, "kind": "equal", "name": f"Rule {i}", "params": {}, "hidden": False}
            for i in range(catalog.MAX_SPLIT_RULES + 1)
        ]
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules(rules)

    def test_duplicate_ids_rejected(self):
        rules = self._minimal_rules()
        rules[1]["id"] = rules[0]["id"]
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules(rules)

    def test_builtin_with_wrong_kind_rejected(self):
        rules = self._minimal_rules()
        rules[0]["kind"] = "percent"  # equality_first must stay 'equal'
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules(rules)

    def test_custom_rule_with_disallowed_kind_rejected(self):
        rules = self._minimal_rules()
        rules.append({"id": "custom1", "builtIn": None, "kind": "income_ratio", "name": "Nope", "params": {}, "hidden": False})
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules(rules)

    def test_custom_rule_without_name_rejected(self):
        rules = self._minimal_rules()
        rules.append({"id": "custom1", "builtIn": None, "kind": "equal", "name": "  ", "params": {}, "hidden": False})
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules(rules)

    def test_valid_custom_percent_rule_passes(self):
        rules = self._minimal_rules()
        rules.append({
            "id": "rent-split", "builtIn": None, "kind": "percent", "name": "Rent 60/40",
            "params": {"weights": {"a": 60, "b": 40}}, "hidden": False,
        })
        catalog.validate_split_rules(rules)  # no raise

    def test_percent_weights_not_summing_to_100_rejected(self):
        rules = self._minimal_rules()
        rules.append({
            "id": "rent-split", "builtIn": None, "kind": "percent", "name": "Rent",
            "params": {"weights": {"a": 60, "b": 30}}, "hidden": False,
        })
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules(rules)

    def test_unset_percent_weights_allowed(self):
        # A member-specific rule can exist with no weights yet (needsReview stays True
        # until an admin configures it) — see plan §3.5.
        rules = self._minimal_rules()
        rules.append({
            "id": "rent-split", "builtIn": None, "kind": "percent", "name": "Rent",
            "params": {}, "hidden": False,
        })
        catalog.validate_split_rules(rules)  # no raise

    def test_negative_weight_rejected(self):
        rules = self._minimal_rules()
        rules.append({
            "id": "rent-split", "builtIn": None, "kind": "shares", "name": "Weighted",
            "params": {"weights": {"a": -1}}, "hidden": False,
        })
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules(rules)

    def test_all_rules_hidden_rejected(self):
        rules = self._minimal_rules()
        for r in rules:
            r["hidden"] = True
        with pytest.raises(catalog.SplitRuleValidationError):
            catalog.validate_split_rules(rules)
