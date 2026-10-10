import { FEATURE_STYLES, parseTimestampToTime } from './dashboardUtils';
import { ledgersOf } from '../../groups/utils/ledgers';
import { simplifyDebts } from '../../groups/utils/simplifyDebts';
import { formatMinorAmount } from '../../groups/utils/money';
import { getMinorUnits } from '../../../lib/fx/currencyMeta';

/** At most this many group notifications reach the feed, so a user in many groups is not flooded. */
export const MAX_GROUP_NOTIFICATIONS = 5;
/** A payment recorded to you stays in the feed this long. */
export const PAYMENT_NOTIFICATION_DAYS = 7;

// Lower rank = more actionable, kept first when the cap cuts the list.
const RANK = { join: 0, payment: 1, owe: 2, owed: 3 };

/** The default-currency total of {currency: minor} amounts as an "approx" suffix, or '' when no conversion is needed or possible. */
function approxSuffix(totals, toDefault, defaultCurrency, locale) {
  const entries = Object.entries(totals);
  if (!entries.length || typeof toDefault !== 'function' || !defaultCurrency) return '';
  if (entries.every(([currency]) => currency === defaultCurrency)) return '';
  let totalMinor = 0;
  for (const [currency, minor] of entries) {
    if (currency === defaultCurrency) {
      totalMinor += minor;
      continue;
    }
    const r = toDefault({ amount: minor / 10 ** getMinorUnits(currency), currency });
    if (r.value == null) return ''; // no rate: show only the real amounts, never a partial total
    totalMinor += Math.round(r.value * 10 ** getMinorUnits(defaultCurrency));
  }
  return ` (≈ ${formatMinorAmount(totalMinor, defaultCurrency, locale)})`;
}

/** "₪120 · $30" (largest first) plus the approximate default-currency total when the currencies differ. */
function describeAmounts(totals, { toDefault, defaultCurrency, locale }) {
  const parts = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([currency, minor]) => formatMinorAmount(minor, currency, locale));
  return parts.join(' · ') + approxSuffix(totals, toDefault, defaultCurrency, locale);
}

/** The simplified transfers (fewest payments, per currency ledger) that involve `userId`. */
export function myTransfers(group, userId) {
  const owe = [];
  const owed = [];
  for (const [currency, balances] of ledgersOf(group)) {
    for (const tx of simplifyDebts(balances)) {
      if (tx.from === userId) owe.push({ other: tx.to, amount: tx.amount, currency });
      else if (tx.to === userId) owed.push({ other: tx.from, amount: tx.amount, currency });
    }
  }
  return { owe, owed };
}

const totalsOf = (transfers) => transfers.reduce((acc, tx) => ({ ...acc, [tx.currency]: (acc[tx.currency] || 0) + tx.amount }), {});
const signatureOf = (transfers) => transfers.map((tx) => `${tx.other}:${tx.currency}:${tx.amount}`).sort().join('|');

/**
 * Group notifications for the dashboard feed, in the same item format detectCycleReminders produces
 * ({ id, feature, symbol, ..., text, createdAt, unread, onClick }) so the row, ordering and dismissal
 * are exactly the existing ones. Pure: every input is a parameter.
 *
 *  - join:    an admin has pending join requests in a group            (group.pendingRequestCount)
 *  - payment: someone recorded a payment to you in the last 7 days     (payments, newest listener data)
 *  - owe:     you owe people in a group (simplified transfers, per currency, approx in default currency)
 *  - owed:    people owe you in a group (same)
 *
 * Ids embed what the notification is about (request count, payment id, the transfers), so dismissing one
 * hides it only until the underlying state changes. The result is capped at MAX_GROUP_NOTIFICATIONS,
 * keeping the most actionable kinds first.
 *
 * @param {object} params
 * @param {Array<object>} params.groups - The user's active groups (group docs with id)
 * @param {Array<object>} [params.payments] - Settlement docs with groupId and id
 * @param {string} params.userId
 * @param {Function} [params.t] - Translation function
 * @param {string} [params.language='en']
 * @param {Function} [params.toDefault] - useFx().toDefault
 * @param {string} [params.defaultCurrency]
 * @param {Date} [params.now=new Date()]
 * @param {Function} [params.onNavigateGroup] - Called with the group id to open that group
 * @param {number} [params.limit]
 * @returns {Array<object>}
 */
export const buildGroupNotifications = ({
  groups = [],
  payments = [],
  userId,
  t = (key, opts) => (opts && opts.defaultValue) || key,
  language = 'en',
  toDefault,
  defaultCurrency,
  now = new Date(),
  onNavigateGroup,
  limit = MAX_GROUP_NOTIFICATIONS,
}) => {
  if (!userId || !Array.isArray(groups) || groups.length === 0) return [];
  const style = FEATURE_STYLES.groups;
  const locale = language?.startsWith('he') ? 'he-IL' : 'en-US';
  const fx = { toDefault, defaultCurrency, locale };
  const refTime = parseTimestampToTime(now) || Date.now();
  const byId = new Map(groups.map((g) => [g.id, g]));
  const items = [];

  const make = (kind, id, group, text, createdAt) => ({
    id,
    kind,
    feature: 'groups',
    symbol: style.symbol,
    symbolColor: style.symbolColor,
    dotColor: style.dotColor,
    unreadBg: style.unreadBg,
    text,
    createdAt,
    unread: true,
    onClick: typeof onNavigateGroup === 'function' ? () => onNavigateGroup(group.id) : undefined,
  });

  const nameOf = (group, uid) => group.members?.[uid]?.displayName || t('dashboard.mainDashboard.notifications.groupSomeone', { defaultValue: 'Someone' });

  for (const group of groups) {
    const groupName = group.name || '';
    const touched = group.updatedAt || group.createdAt || now;

    // Admin: join requests waiting. Counted from the group doc, so no extra listener.
    const pending = Number(group.pendingRequestCount) || 0;
    if (group.members?.[userId]?.role === 'admin' && pending > 0) {
      items.push(make('join', `group_join_${group.id}_${pending}`, group,
        t('dashboard.mainDashboard.notifications.groupJoinRequests', {
          count: pending,
          group: groupName,
          defaultValue: pending === 1
            ? `A join request is waiting for approval in ${groupName}`
            : `${pending} join requests are waiting for approval in ${groupName}`,
        }), touched));
    }

    // Balances: the simplified transfers that involve me.
    const { owe, owed } = myTransfers(group, userId);
    for (const [kind, transfers] of [['owe', owe], ['owed', owed]]) {
      if (transfers.length === 0) continue;
      const people = [...new Set(transfers.map((tx) => tx.other))];
      const amount = describeAmounts(totalsOf(transfers), fx);
      const one = people.length === 1;
      const key = `dashboard.mainDashboard.notifications.${kind === 'owe' ? 'groupYouOwe' : 'groupOwedToYou'}${one ? '' : 'Many'}`;
      const fallback = kind === 'owe'
        ? (one ? `You owe {{name}} {{amount}} in {{group}}` : `You owe {{count}} people {{amount}} in {{group}}`)
        : (one ? `{{name}} owes you {{amount}} in {{group}}` : `{{count}} people owe you {{amount}} in {{group}}`);
      items.push(make(kind, `group_${kind}_${group.id}_${signatureOf(transfers)}`, group,
        t(key, { name: one ? nameOf(group, people[0]) : '', count: people.length, amount, group: groupName, defaultValue: fallback }),
        touched));
    }
  }

  // Payments recorded to me, recent only.
  const cutoff = refTime - PAYMENT_NOTIFICATION_DAYS * 86400000;
  for (const p of Array.isArray(payments) ? payments : []) {
    const group = byId.get(p.groupId);
    if (!group || p.deleted || p.to !== userId || p.from === userId || p.createdBy === userId) continue;
    const when = parseTimestampToTime(p.createdAt) || refTime; // a pending local write has no server time yet
    if (when < cutoff) continue;
    const amount = formatMinorAmount(p.amountMinor, p.currency || group.currency, locale);
    items.push(make('payment', `group_payment_${p.groupId}_${p.id}`, group,
      t('dashboard.mainDashboard.notifications.groupPaymentReceived', {
        name: nameOf(group, p.from),
        amount,
        group: group.name || '',
        defaultValue: `${nameOf(group, p.from)} paid you ${amount} in ${group.name || ''}`,
      }), p.createdAt || now));
  }

  // Dedupe by id, keep the most actionable kinds (then newest) when over the cap.
  const seen = new Set();
  return items
    .filter((n) => (seen.has(n.id) ? false : seen.add(n.id)))
    .sort((a, b) => RANK[a.kind] - RANK[b.kind] || parseTimestampToTime(b.createdAt) - parseTimestampToTime(a.createdAt))
    .slice(0, limit)
    .map((n) => ({ ...n, kind: undefined })); // `kind` was only for ranking
};

export default buildGroupNotifications;
