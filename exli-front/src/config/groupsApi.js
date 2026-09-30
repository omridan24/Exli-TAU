import { auth, CLOUD_RUN_URL } from './firebase';

/**
 * fetch() wrapper that attaches the signed-in user's Firebase ID token.
 * Every /groups* endpoint requires this (exli-backend/utils/auth.py's
 * @require_auth) — unlike the rest of the app's endpoints, which don't verify
 * the caller yet. See docs/groups/01-backend-db-plan.md.
 */
export async function authedFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in.');
  }
  const token = await user.getIdToken();

  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  // Don't force JSON headers on a file upload — the browser needs to set its
  // own multipart boundary for FormData bodies.
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${CLOUD_RUN_URL}${path}`, { ...options, headers });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // no JSON body (e.g. a 204) — fine
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.code = data?.code;
    error.status = response.status;
    throw error;
  }

  return data;
}

const json = (body) => JSON.stringify(body);

export const groupsApi = {
  createGroup: (payload) => authedFetch('/groups', { method: 'POST', body: json(payload) }),
  updateGroup: (groupId, patch) => authedFetch(`/groups/${groupId}`, { method: 'PATCH', body: json(patch) }),
  deleteGroup: (groupId) => authedFetch(`/groups/${groupId}`, { method: 'DELETE' }),

  createInvite: (groupId, expiresInDays) =>
    authedFetch(`/groups/${groupId}/invite`, { method: 'POST', body: json({ expiresInDays: expiresInDays || null }) }),
  rotateInvite: (groupId, expiresInDays) =>
    authedFetch(`/groups/${groupId}/invite/rotate`, { method: 'POST', body: json({ expiresInDays: expiresInDays || null }) }),
  revokeInvite: (groupId) => authedFetch(`/groups/${groupId}/invite`, { method: 'DELETE' }),

  getInvitePreview: (token) => authedFetch(`/invites/${token}`),
  requestToJoin: (token) => authedFetch(`/invites/${token}/request`, { method: 'POST' }),
  cancelJoinRequest: (token) => authedFetch(`/invites/${token}/request`, { method: 'DELETE' }),

  approveRequest: (groupId, targetUid) =>
    authedFetch(`/groups/${groupId}/requests/${targetUid}/approve`, { method: 'POST' }),
  rejectRequest: (groupId, targetUid) =>
    authedFetch(`/groups/${groupId}/requests/${targetUid}/reject`, { method: 'POST' }),

  updateMemberRole: (groupId, targetUid, role) =>
    authedFetch(`/groups/${groupId}/members/${targetUid}`, { method: 'PATCH', body: json({ role }) }),
  removeMember: (groupId, targetUid) =>
    authedFetch(`/groups/${groupId}/members/${targetUid}`, { method: 'DELETE' }),

  setSplitRules: (groupId, rules, defaultSplitRuleId) =>
    authedFetch(`/groups/${groupId}/split-rules`, { method: 'PUT', body: json({ rules, defaultSplitRuleId }) }),
  getIncomeRatioPreview: (groupId, date) =>
    authedFetch(`/groups/${groupId}/income-ratio${date ? `?date=${date}` : ''}`),

  createExpense: (groupId, payload) => authedFetch(`/groups/${groupId}/expenses`, { method: 'POST', body: json(payload) }),
  transferPersonalExpense: (groupId, personalExpenseId, splitInput) =>
    authedFetch(`/groups/${groupId}/expenses/from-personal`, {
      method: 'POST', body: json({ personalExpenseId, split: splitInput }),
    }),
  transferPersonalExpensesBatch: (groupId, personalExpenseIds, splitRuleId) =>
    authedFetch(`/groups/${groupId}/expenses/from-personal/batch`, {
      method: 'POST', body: json({ personalExpenseIds, splitRuleId }),
    }),
  removePersonalExpenseFromGroup: (groupId, personalExpenseId) =>
    authedFetch(`/groups/${groupId}/expenses/from-personal/${personalExpenseId}`, { method: 'DELETE' }),
  editExpense: (groupId, expenseId, payload) =>
    authedFetch(`/groups/${groupId}/expenses/${expenseId}`, { method: 'PATCH', body: json(payload) }),
  deleteExpense: (groupId, expenseId) =>
    authedFetch(`/groups/${groupId}/expenses/${expenseId}`, { method: 'DELETE' }),

  uploadImage: (groupId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return authedFetch(`/groups/${groupId}/image`, { method: 'POST', body: formData });
  },
};
