/**
 * Pure split math for group expenses — the CLIENT-SIDE mirror of
 * exli-backend/services/split_engine.py, used only for the SplitPicker's live
 * preview while you drag/type. The server recomputes authoritatively on save and
 * never trusts a client-sent share — see docs/groups/02-phase2-ui-and-splits-plan.md
 * §3.4 / §3.7 / Debate K.
 *
 * Both implementations are checked against the same fixtures in
 * docs/groups/split-test-vectors.json (see verify-split-vectors.mjs) so they can't
 * silently drift apart. If you change the rounding/distribution rule here, change
 * split_engine.py and the shared vectors too.
 */

export const SPLIT_KINDS = ['equal', 'payer_covers', 'others_cover', 'shares', 'percent', 'income_ratio', 'custom'];

// Kinds whose weights are tied to specific people (Debate H maintenance on join/leave).
export const MEMBER_SPECIFIC_KINDS = ['shares', 'percent'];

export class SplitError extends Error {}

/**
 * Every uid in `weights` (positive integers) gets floor(amount * weight / total),
 * via integer division so there's no floating-point rounding error. The leftover
 * goes ENTIRELY to `remainderReceiverUid` if they're one of the weighted uids,
 * otherwise to the smallest uid (stable, deterministic) — "the payer absorbs the
 * rounding" from the plan.
 */
function distributeWeighted(amountMinor, weights, remainderReceiverUid) {
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    throw new SplitError('Split weights must sum to more than zero.');
  }

  const shares = {};
  let distributed = 0;
  for (const [uid, weight] of Object.entries(weights)) {
    const share = Math.floor((amountMinor * weight) / totalWeight);
    shares[uid] = share;
    distributed += share;
  }

  const remainder = amountMinor - distributed;
  if (remainder !== 0) {
    const receiver = Object.prototype.hasOwnProperty.call(shares, remainderReceiverUid)
      ? remainderReceiverUid
      : Object.keys(shares).sort()[0];
    shares[receiver] += remainder;
  }

  return shares;
}

/**
 * @param {number} amountMinor - positive integer, minor currency units (agorot)
 * @param {string} kind - one of SPLIT_KINDS
 * @param {string[]} participants - uids this expense is split among
 * @param {string} payerId - uid who paid
 * @param {object} [params] - kind-specific: { weights: {uid:int} } or { amounts: {uid:int} }
 * @returns {Record<string, number>} shares summing EXACTLY to amountMinor
 */
export function computeShares(amountMinor, kind, participants, payerId, params = {}) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new SplitError('Amount must be a positive integer number of minor units.');
  }

  const uniqueParticipants = [...new Set(participants)];
  if (uniqueParticipants.length === 0) {
    throw new SplitError('At least one participant is required.');
  }

  switch (kind) {
    case 'equal': {
      const weights = Object.fromEntries(uniqueParticipants.map((uid) => [uid, 1]));
      return distributeWeighted(amountMinor, weights, payerId);
    }

    case 'payer_covers': {
      // The payer's own share IS the full amount: net balance change is zero.
      return { [payerId]: amountMinor };
    }

    case 'others_cover': {
      const others = uniqueParticipants.filter((uid) => uid !== payerId);
      if (others.length === 0) {
        throw new SplitError("This split needs at least one other participant.");
      }
      const weights = Object.fromEntries(others.map((uid) => [uid, 1]));
      const shares = distributeWeighted(amountMinor, weights, [...others].sort()[0]);
      shares[payerId] = 0;
      return shares;
    }

    case 'shares':
    case 'percent':
    case 'income_ratio': {
      const rawWeights = (params && params.weights) || {};
      const weights = Object.fromEntries(
        Object.entries(rawWeights).filter(([uid, w]) => uniqueParticipants.includes(uid) && w > 0)
      );
      if (Object.keys(weights).length === 0) {
        throw new SplitError('At least one participant needs a positive weight.');
      }
      return distributeWeighted(amountMinor, weights, payerId);
    }

    case 'custom': {
      const amounts = (params && params.amounts) || {};
      const missing = uniqueParticipants.filter((uid) => !(uid in amounts));
      if (missing.length > 0) {
        throw new SplitError('Every participant needs an amount in a custom split.');
      }
      const shares = {};
      let total = 0;
      for (const uid of uniqueParticipants) {
        const value = Math.trunc(amounts[uid]);
        if (value < 0) throw new SplitError("Custom amounts can't be negative.");
        shares[uid] = value;
        total += value;
      }
      if (total !== amountMinor) {
        throw new SplitError(`Custom amounts must sum to ${amountMinor}, got ${total}.`);
      }
      return shares;
    }

    default:
      throw new SplitError(`Unknown split kind: ${kind}`);
  }
}
