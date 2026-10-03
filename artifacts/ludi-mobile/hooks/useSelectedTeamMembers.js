import { useCallback, useEffect, useRef, useState } from 'react';

export const memberName = (user, id, currentUserId) => {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const base = full || user?.username || 'Unnamed member';
  return currentUserId && id === currentUserId ? `${base} (You)` : base;
};

// Loads /api/teams/:id/members for each team, dedupes by USER id, ignores stale responses.
export default function useSelectedTeamMembers(apiRequest, teamIds, currentUserId) {
  const [state, setState] = useState({ members: [], loading: false, error: null });
  const reqRef = useRef(0);
  const key = teamIds.filter(Boolean).join(',');
  const apiRef = useRef(apiRequest);
  apiRef.current = apiRequest;

  const load = useCallback(async () => {
    const ids = key ? key.split(',') : [];
    const req = ++reqRef.current;
    if (ids.length === 0) { setState({ members: [], loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    const seen = new Set();
    const members = [];
    let failed = 0;
    await Promise.all(ids.map(async (teamId) => {
      try {
        const res = await apiRef.current(`/api/teams/${teamId}/members`);
        if (!res.ok) throw new Error(String(res.status));
        const rows = await res.json();
        return (Array.isArray(rows) ? rows : []).map((m) => ({ teamId, m }));
      } catch { failed += 1; return []; }
    })).then((lists) => {
      for (const list of lists) for (const { m } of list) {
        const uid = m.userId || m.user?.id;
        if (!uid || seen.has(uid)) continue;
        seen.add(uid);
        members.push({ id: uid, name: memberName(m.user, uid, currentUserId), username: m.user?.username || '' });
      }
    });
    if (req !== reqRef.current) return; // stale
    setState({
      members, loading: false,
      error: failed ? (failed === ids.length ? 'Could not load team members.' : 'Some team members could not be loaded.') : null,
    });
  }, [key, currentUserId]);

  useEffect(() => { load(); }, [load]);
  return { ...state, retry: load };
}
