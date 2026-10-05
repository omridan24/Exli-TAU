export const FIXED = '__fixed__';
export const TOTAL_BP = 10000; // fixed-percentage weights are hundredths of a percent (10000 = 100%)

/** The select value a group's current default corresponds to ('' = none configured yet). */
export const initialDefaultChoice = (group) =>
  group.defaultFixedSplit ? FIXED : (group.defaultSplitConfigured ? group.defaultSplitRuleId : '');
