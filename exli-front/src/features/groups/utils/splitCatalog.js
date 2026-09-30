/**
 * Built-in split-rule catalog — mirrors exli-backend/services/split_catalog.py.
 * Names come from i18n (`groups.splitRules.builtIn.<id>.name`), per I18N_RULES.md.
 * See docs/groups/02-phase2-ui-and-splits-plan.md §3.2 (catalog) and §3.7 (income).
 */

export const BUILT_IN_RULES = {
  equality_first: { kind: 'equal', emoji: '⚖️' },
  love_but_i_pay: { kind: 'payer_covers', emoji: '❤️' },
  youre_paying: { kind: 'payer_covers', emoji: '😘' },
  your_treat: { kind: 'others_cover', emoji: '🎁' },
  this_rounds_on_me: { kind: 'payer_covers', emoji: '🍻' },
  family_pack: { kind: 'shares', emoji: '👨‍👩‍👧' },
  fair_share: { kind: 'percent', emoji: '📐' },
  split_by_income: { kind: 'income_ratio', emoji: '💼' },
};

// What kind an admin-CREATED (non-built-in) rule may use. income_ratio only ever
// exists as the split_by_income built-in; "custom" (Pour It Yourself) is never a
// stored rule at all — see the plan §3.1.
export const ADMIN_CREATABLE_KINDS = ['equal', 'shares', 'percent', 'payer_covers', 'others_cover'];

// Kinds whose weights are tied to specific people (Debate H: join/leave maintenance).
export const MEMBER_SPECIFIC_KINDS = ['shares', 'percent'];

export const MAX_SPLIT_RULES = 20;

/** Display name for a rule: built-ins use their fixed i18n name; custom rules use their own `name`. */
export function splitRuleName(rule, t) {
  if (rule.builtIn) return t(`groups.splitRules.builtIn.${rule.builtIn}.name`);
  return rule.name || t('groups.splitRules.custom.name', 'Pour It Yourself');
}

export function splitRuleEmoji(rule) {
  if (rule.builtIn) return BUILT_IN_RULES[rule.builtIn]?.emoji || rule.emoji;
  return rule.emoji || '✨';
}

/** Short (<=6 word) plain-language explanation shown right in the split picker,
 * so what a rule actually does doesn't depend on guessing from its name alone. */
export function splitRuleDescription(rule, t) {
  if (rule.builtIn) return t(`groups.splitRules.builtIn.${rule.builtIn}.description`);
  return t('groups.splitRules.custom.description');
}
