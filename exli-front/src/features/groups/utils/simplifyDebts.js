/** Greedy min-transaction debt simplification (plan §8: "who owes whom" is always
 * computed on read from `balances`, never stored). balances: {uid: minorUnits},
 * summing to 0. Returns [{from, to, amount}], amount > 0, minimal transaction count. */
export function simplifyDebts(balances) {
  const creditors = [];
  const debtors = [];
  for (const [uid, amount] of Object.entries(balances || {})) {
    if (amount > 0) creditors.push({ uid, amount });
    else if (amount < 0) debtors.push({ uid, amount: -amount });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

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
