#!/usr/bin/env node
/**
 * Checks src/features/groups/utils/simplifyDebts.js: the cases the work plan promised (circular
 * debts, chain, star, zero balances), that every result really settles everyone, that it never
 * needs more than (people - 1) transfers, that it is never worse than the plain greedy matching,
 * and that it is exactly minimal (brute-forced) on small groups.
 *
 * Plain Node script, no test framework, like verify-split-vectors.mjs. Run:
 *   node scripts/verify-debt-vectors.mjs
 */
import assert from 'node:assert/strict';
import { simplifyDebts, greedySettle } from '../src/features/groups/utils/simplifyDebts.js';

let passed = 0;
let failed = 0;
const check = (name, fn) => {
  try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL: ${name}\n  ${e.message}`); }
};

const settles = (balances, txs) => {
  const left = { ...balances };
  for (const t of txs) {
    assert.ok(t.amount > 0, 'amounts must be positive');
    left[t.from] = (left[t.from] || 0) + t.amount;
    left[t.to] = (left[t.to] || 0) - t.amount;
  }
  for (const [uid, v] of Object.entries(left)) assert.ok(v === 0, `${uid} is left with ${v}`);
};

// Brute force: smallest number of transfers = people - (max zero-sum partition), by trying every partition.
const bruteMin = (balances) => {
  const vals = Object.values(balances).filter((v) => v !== 0);
  const n = vals.length;
  let bestGroups = 0;
  const assign = new Array(n).fill(0);
  const recurse = (i, groups) => {
    if (i === n) {
      const sums = new Array(groups).fill(0);
      vals.forEach((v, k) => { sums[assign[k]] += v; });
      if (sums.every((s) => s === 0)) bestGroups = Math.max(bestGroups, groups);
      return;
    }
    for (let g = 0; g <= groups; g++) { assign[i] = g; recurse(i + 1, Math.max(groups, g + 1)); }
  };
  if (n) recurse(0, 0);
  return n - bestGroups;
};

check('circular debts cancel out (A->B->C->A, 50 each) -> no transfers', () => {
  assert.deepEqual(simplifyDebts({ a: 0, b: 0, c: 0 }), []);
});

check('chain: A owes B 50, B owes C 50 -> A pays C 50 directly', () => {
  // net: A -50, B 0, C +50
  assert.deepEqual(simplifyDebts({ a: -50, b: 0, c: 50 }), [{ from: 'a', to: 'c', amount: 50 }]);
});

check('star: three people each owe D 30 -> three transfers to D', () => {
  const txs = simplifyDebts({ a: -30, b: -30, c: -30, d: 90 });
  assert.equal(txs.length, 3);
  assert.ok(txs.every((t) => t.to === 'd' && t.amount === 30));
});

check('zero balances / empty / missing -> nothing', () => {
  assert.deepEqual(simplifyDebts({ a: 0, b: 0 }), []);
  assert.deepEqual(simplifyDebts({}), []);
  assert.deepEqual(simplifyDebts(undefined), []);
});

check('two separate pairs settle as two transfers, not three', () => {
  // +5 -5 and +7 -7 : greedy by size can pair across clusters and need 3
  const balances = { a: 7, b: 5, c: -5, d: -7 };
  const txs = simplifyDebts(balances);
  settles(balances, txs);
  assert.equal(txs.length, 2);
});

check('exact beats greedy on a known case', () => {
  // clusters {+7,-7}, {+5,-2,-3}: greedy pairs the biggest debtor with the biggest creditor first
  const balances = { a: 7, b: 5, c: -7, d: -2, e: -3 };
  const exact = simplifyDebts(balances);
  const entries = Object.entries(balances).map(([uid, amount]) => ({ uid, amount }));
  settles(balances, exact);
  assert.equal(exact.length, bruteMin(balances));
  assert.ok(exact.length <= greedySettle(entries).length);
});

check('randomised: always settles, <= n-1 transfers, never worse than greedy, equals the brute-force minimum', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let strictlyBetter = 0;
  for (let round = 0; round < 600; round++) {
    const n = 2 + Math.floor(rnd() * 6); // 2..7 people
    const balances = {};
    let total = 0;
    for (let i = 0; i < n - 1; i++) {
      const v = Math.round((rnd() - 0.5) * 20); // small ints make zero-sum sub-clusters likely
      balances[`u${i}`] = v;
      total += v;
    }
    balances[`u${n - 1}`] = -total;
    const entries = Object.entries(balances).filter(([, v]) => v !== 0).map(([uid, amount]) => ({ uid, amount }));
    const txs = simplifyDebts(balances);
    settles(balances, txs);
    assert.ok(txs.length <= Math.max(entries.length - 1, 0), `more than n-1 transfers for ${JSON.stringify(balances)}`);
    const greedy = greedySettle(entries).length;
    assert.ok(txs.length <= greedy, 'must never be worse than greedy');
    if (txs.length < greedy) strictlyBetter++;
    assert.equal(txs.length, bruteMin(balances), `not minimal for ${JSON.stringify(balances)}`);
  }
  console.log(`  (exact beat plain greedy in ${strictlyBetter} of 600 random groups)`);
});

check('large group (> exact limit) still settles within n-1 transfers', () => {
  const balances = {};
  let total = 0;
  for (let i = 0; i < 24; i++) { const v = (i % 7) * 13 - 30; balances[`u${i}`] = v; total += v; }
  balances.u23 -= total;
  const txs = simplifyDebts(balances);
  settles(balances, txs);
  assert.ok(txs.length <= 23);
});

console.log(`${passed} passed, ${failed} failed (${passed + failed} total)`);
process.exit(failed ? 1 : 0);
