/**
 * "Who owes whom", always computed on read from `balances` (plan §8), never stored.
 * balances: {uid: minorUnits}, summing to 0 (positive = is owed, negative = owes).
 * Returns [{from, to, amount}], amount > 0.
 *
 * Step 1 - netting. Working from each person's NET balance already cancels every circular debt
 * (A owes B, B owes C, C owes A all become 0) and any "I owe you, you owe them" chain.
 *
 * Step 2 - fewest transfers. Any set of people whose balances sum to zero can settle among
 * themselves, needing (size - 1) transfers. So the minimum for the whole group is
 * (people with a balance) - (the most separate zero-sum clusters we can split them into).
 * Finding that split is NP-hard in general, so for groups up to EXACT_LIMIT people with a balance
 * (every realistic friends / household / trip group) it is solved EXACTLY by dynamic programming
 * over subsets; larger groups fall back to the greedy largest-debtor-pays-largest-creditor
 * matching, which is guaranteed to need at most (people - 1) transfers.
 */
export const EXACT_LIMIT = 14;

/** Settle one cluster greedily: largest debtor pays largest creditor. At most (size - 1) transfers. */
export function greedySettle(entries) {
  const creditors = entries.filter((e) => e.amount > 0).map((e) => ({ ...e })).sort((a, b) => b.amount - a.amount);
  const debtors = entries.filter((e) => e.amount < 0).map((e) => ({ uid: e.uid, amount: -e.amount })).sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) transactions.push({ from: debtors[i].uid, to: creditors[j].uid, amount });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return transactions;
}

/** Splits `entries` into the largest number of disjoint zero-sum clusters (exact, O(2^n * n)). */
function bestClusters(entries) {
  const n = entries.length;
  const size = 1 << n;
  const sum = new Int32Array(size);
  const best = new Int16Array(size); // most zero-sum clusters formable from this subset
  const last = new Int8Array(size); // element appended last in the best ordering of this subset

  // Amounts can exceed Int32 only for absurd balances; fall back to Float64 in that case.
  const useFloat = entries.some((e) => Math.abs(e.amount) > 2e9 / n);
  const sums = useFloat ? new Float64Array(size) : sum;

  for (let mask = 1; mask < size; mask++) {
    const low = 31 - Math.clz32(mask & -mask);
    sums[mask] = sums[mask & (mask - 1)] + entries[low].amount;
    let bestCount = -1;
    let bestLast = 0;
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const count = best[mask ^ (1 << i)];
      if (count > bestCount) { bestCount = count; bestLast = i; }
    }
    best[mask] = bestCount + (sums[mask] === 0 ? 1 : 0);
    last[mask] = bestLast;
  }

  // Walk back to recover the ordering, then cut it wherever the running total returns to zero.
  const order = [];
  for (let mask = size - 1; mask; mask ^= 1 << last[mask]) order.push(last[mask]);
  order.reverse();

  const clusters = [];
  let current = [];
  let running = 0;
  for (const idx of order) {
    current.push(entries[idx]);
    running += entries[idx].amount;
    if (running === 0) { clusters.push(current); current = []; }
  }
  if (current.length) clusters.push(current); // only if the balances didn't sum to zero
  return clusters;
}

export function simplifyDebts(balances) {
  const entries = Object.entries(balances || {})
    .filter(([, amount]) => amount !== 0)
    .map(([uid, amount]) => ({ uid, amount }));
  if (entries.length === 0) return [];

  const clusters = entries.length <= EXACT_LIMIT ? bestClusters(entries) : [entries];
  return clusters
    .flatMap(greedySettle)
    .sort((a, b) => b.amount - a.amount || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}
