/**
 * Mirrors services/groups_service.get_currency_settings() — docs/fx/01-fx-plan.md
 * §6. A group created before this feature shipped has no `currencySettings`
 * field at all; it's read as if migrated to {mode: "merge", mergeCurrency:
 * group.currency}, exactly today's behavior, without any Firestore write.
 */
export function getCurrencySettings(group) {
  if (group?.currencySettings) return group.currencySettings;
  return { mode: 'merge', mergeCurrency: group?.currency || 'ILS' };
}

export function isKeepOriginal(group) {
  return getCurrencySettings(group).mode === 'keep_original';
}
