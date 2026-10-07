import { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Share, Alert } from 'react-native';
import { useBrandTypography } from './home/brand';
import { BrandText as Text, BrandTextInput as TextInput } from './brand/BrandText';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const gbp = (m) => `£${((m || 0) / 100).toFixed(2)}`;
const toMinor = (v) => {
  const t = String(v ?? '').trim();
  if (t === '') return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
};
const toInput = (m) => (m ? (m / 100).toFixed(2) : '');
const STATUS = { draft: 'Draft', reconciling: 'Reconciling', ready: 'Ready to close', closing: 'Closing', closed: 'Closed' };

export default function EventCloseout({ event, onBack }) {
  const { apiRequest } = useAuth();
  const { colors } = useTheme();
  const typography = useBrandTypography();
  const base = `/api/events/${event.id}/closeout`;

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cost, setCost] = useState('');
  const [players, setPlayers] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [links, setLinks] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);

  const dirtyRef = useRef(false);
  const busyRef = useRef(false);
  dirtyRef.current = dirty;
  busyRef.current = busy;
  const seed = (s) => {
    setCost(toInput(s.venueCostMinor));
    setPlayers((s.players || []).map((p) => ({ userId: p.userId, name: p.name, email: p.email, method: p.method, cash: toInput(p.cashAmountMinor) })));
    setDirty(false);
  };

  const call = async (path, method, body) => {
    const response = await apiRequest(`${base}${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
  };

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { const s = await call('', 'GET'); setState(s); seed(s); }
    catch (e) { setLoadError(e.message || 'Close details could not be loaded'); }
    finally { setLoading(false); }
  }, [event.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(async () => {
      if (dirtyRef.current || busyRef.current) return;
      try { const s = await call('', 'GET'); setState(s); seed(s); } catch (e) { /* keep last state */ }
    }, 20000);
    return () => clearInterval(t);
  }, [event.id]);

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const status = state?.status || 'draft';
  const frozen = status !== 'draft';
  const closed = status === 'closed';
  const serverById = new Map((state?.players || []).map((p) => [p.userId, p]));
  const refundPending = !!state?.refundPending || (state?.players || []).some((p) => p.refundPending);
  const costMinor = toMinor(cost);
  const cashInvalid = players.some((p) => {
    if (p.method !== 'cash') return false;
    const m = toMinor(p.cash);
    if (m === null) return true;
    const sp = serverById.get(p.userId);
    return frozen && !!sp && m > sp.shareMinor;
  });
  const draftValid = costMinor !== null && costMinor > 0 && players.length > 0 && !cashInvalid;
  const candidates = (state?.candidates || []).filter((c) => !players.some((p) => p.userId === c.userId));
  const canCloseNow = (status === 'ready' || status === 'closing') && !refundPending && !dirty;

  const patch = (userId, change) => { setPlayers((prev) => prev.map((p) => (p.userId === userId ? { ...p, ...change } : p))); setDirty(true); };

  const save = () => run(async () => {
    const s = await call('', 'PUT', {
      venueCostMinor: frozen ? state.venueCostMinor : costMinor,
      players: players.map((p) => ({ userId: p.userId, method: p.method, cashAmountMinor: p.method === 'cash' ? toMinor(p.cash) : 0 })),
    });
    setState(s); seed(s);
    if (frozen) { const r = await call('/reconcile', 'POST'); setState(r); seed(r); }
  });
  const reconcile = () => run(async () => { const s = await call('/reconcile', 'POST'); setState(s); seed(s); });
  const refresh = async () => {
    if (dirty) {
      try { const s = await call('', 'GET'); setState(s); } catch (e) { setError(e.message || 'Could not refresh'); }
    } else load();
  };
  const makeLink = (userId) => run(async () => {
    const r = await call('/links', 'POST', { userId });
    setLinks((l) => ({ ...l, [userId]: r.url }));
    if (r.state) setState(r.state);
  });
  const shareLink = async (url, name) => {
    try { await Share.share({ message: `Pay your share for ${event.name}, ${name}: ${url}`, url }); } catch (e) { setError('Could not open the share sheet'); }
  };
  const close = () => run(async () => {
    const expected = state.payoutMinor; const revision = state.revision;
    try {
      const s = await call('/close', 'POST', { acknowledged: true, expectedPayoutMinor: expected, revision });
      setState(s); seed(s); setAck(false);
      if (s.status === 'closed') setConfirming(false);
      else if (s.payoutMinor !== expected || s.revision !== revision) setNotice('The payout amount changed while you were confirming. Review the new amount and confirm again.');
      else if (s.payoutError) setError(s.payoutError);
    } catch (e) {
      setAck(false);
      load();
      throw e;
    }
  });

  const card = { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border };
  const input = { borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 12, minHeight: 48, borderRadius: 12, backgroundColor: colors.inputBackground };
  const btn = (primary, off) => ({ minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, backgroundColor: primary ? colors.primary : 'transparent', borderWidth: primary ? 0 : 1, borderColor: colors.border, opacity: off ? 0.45 : 1 });
  const btnText = (primary) => ({ color: primary ? colors.buttonText : colors.text, fontWeight: '700' });
  const Row = ({ k, v, bold }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: colors.text, flex: 1, fontWeight: bold ? '700' : '400' }}>{k}</Text>
      <Text style={{ color: colors.text, fontWeight: bold ? '700' : '400' }}>{v}</Text>
    </View>
  );

  const header = (
    <TouchableOpacity onPress={onBack} disabled={busy} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.primary, fontWeight: '700' }}>Back to event</Text>
    </TouchableOpacity>
  );

  if (loading) return <View style={{ flex: 1, padding: 24, backgroundColor: colors.background }}>{header}<ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} accessibilityLabel="Loading close details" /></View>;
  if (loadError || !state) return (
    <View style={{ flex: 1, padding: 24, gap: 12, backgroundColor: colors.background }}>
      {header}
      <Text accessibilityRole="alert" style={{ color: colors.error }}>{loadError || 'Close details could not be loaded'}</Text>
      <TouchableOpacity onPress={load} accessibilityRole="button" style={btn(true)}><Text style={btnText(true)}>Retry</Text></TouchableOpacity>
    </View>
  );
  if (state.supported === false) return <View style={{ flex: 1, padding: 24, backgroundColor: colors.background }}>{header}<Text style={{ color: colors.text }}>This event does not use the close flow.</Text></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {header}
      <Text accessibilityRole="header" style={[typography.display, { color: colors.text, fontSize: 28 }]}>Close event</Text>
      <Text style={{ color: colors.text }}>{event.name}. Saving a draft pays no one. Confirming refunds unused venue base only (not original fees) and does not pay you.</Text>
      <TouchableOpacity onPress={refresh} disabled={busy} accessibilityRole="button" style={btn(false, busy)}><Text style={btnText(false)}>Refresh payments</Text></TouchableOpacity>
      <Text style={{ color: colors.textSecondary }}>Status: {STATUS[status] || status}{refundPending ? '  |  Refunds pending' : ''}</Text>

      {frozen && (
        <View style={card}>
          <Text style={{ color: colors.text }}>
            {closed
              ? 'This event is closed. The final roster, venue cost and payout below are the permanent record.'
              : 'The roster and venue cost are frozen because unused venue base was refunded against them. You can still mark online players as cash and retry venue-only refunds. Original fees are never refunded.'}
          </Text>
        </View>
      )}

      <View style={card}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Final venue cost (GBP)</Text>
        <TextInput testID="input-closeout-cost" accessibilityLabel="Final venue cost in pounds" value={frozen ? toInput(state.venueCostMinor) : cost}
          onChangeText={(v) => { setCost(v); setDirty(true); }} keyboardType="decimal-pad" editable={!frozen && !busy} placeholder="0.00" placeholderTextColor={colors.textSecondary} style={input} />
        {!frozen && costMinor === null && <Text style={{ color: colors.error }}>Enter pounds and pence, for example 84.50.</Text>}
      </View>

      <View style={card}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Final players ({players.length})</Text>
        {players.length === 0 && <Text style={{ color: colors.textSecondary }}>No players yet. Add the people who played.</Text>}
        {players.map((p) => {
          const sp = serverById.get(p.userId);
          const isOrganiser = p.userId === state.organiserId;
          const methodLocked = busy || (frozen && (closed || !sp || sp.method === 'cash'));
          const url = links[p.userId] || sp?.linkUrl;
          const canLink = !!sp?.canPayLink && !isOrganiser && p.method === 'online' && !dirty && !closed;
          return (
            <View key={p.userId} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{p.name}{isOrganiser ? '  (Organiser)' : ''}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{p.email}</Text>
                  {sp && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Share {gbp(sp.shareMinor)}  |  Paid online {gbp(sp.onlinePaidMinor)}{sp.refundPending ? '  |  Refund pending' : ''}</Text>}
                </View>
                {!frozen && (
                  <TouchableOpacity onPress={() => { setPlayers((prev) => prev.filter((x) => x.userId !== p.userId)); setDirty(true); }} disabled={busy}
                    accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.error, fontWeight: '700' }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!isOrganiser && <View style={{ flexDirection: 'row', gap: 8 }}>
                {['online', 'cash'].map((m) => {
                  const on = p.method === m;
                  const off = methodLocked || (frozen && m === 'online' && sp?.method === 'cash');
                  return (
                    <TouchableOpacity key={m} disabled={off} onPress={() => patch(p.userId, { method: m })} accessibilityRole="button" accessibilityState={{ selected: on, disabled: off }}
                      accessibilityLabel={`${p.name} ${m === 'cash' ? 'cash received' : 'pays online'}`} style={[btn(on, off), { flex: 1 }]}>
                      <Text style={btnText(on)}>{m === 'cash' ? 'Cash received' : 'Online'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>}
              {isOrganiser && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Your own venue share is self-funded. It is not a cash receipt and is deducted at close.</Text>}
              {!isOrganiser && p.method === 'cash' && (
                <TextInput accessibilityLabel={`Cash received from ${p.name}`} value={p.cash} onChangeText={(v) => patch(p.userId, { cash: v })} keyboardType="decimal-pad"
                  editable={!busy && !closed} placeholder="Cash amount received, e.g. 7.50" placeholderTextColor={colors.textSecondary} style={input} />
              )}
              {canLink && (
                <TouchableOpacity onPress={() => makeLink(p.userId)} disabled={busy} accessibilityRole="button" style={btn(false, busy)}>
                  <Text style={btnText(false)}>{url ? 'Create a new payment link' : 'Create payment link'}</Text>
                </TouchableOpacity>
              )}
              {url && canLink && (
                <View style={{ gap: 6 }}>
                  <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>{url}</Text>
                  <TouchableOpacity onPress={() => shareLink(url, p.name)} accessibilityRole="button" style={btn(true)}><Text style={btnText(true)}>Share or copy link</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {!frozen && (
          <View style={{ gap: 8 }}>
            <TouchableOpacity onPress={() => setShowCandidates((v) => !v)} disabled={busy || candidates.length === 0} accessibilityRole="button" style={btn(false, candidates.length === 0)}>
              <Text style={btnText(false)}>{candidates.length ? (showCandidates ? 'Hide candidates' : 'Add a player who never voted or paid') : 'No other candidates available'}</Text>
            </TouchableOpacity>
            {showCandidates && candidates.map((c) => (
              <TouchableOpacity key={c.userId} accessibilityRole="button" accessibilityLabel={`Add ${c.name}`}
                onPress={() => { setPlayers((prev) => [...prev, { userId: c.userId, name: c.name, email: c.email, method: 'online', cash: '' }]); setDirty(true); }}
                style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.text }}>{c.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{c.email}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {frozen && (
        <View style={card} accessibilityLabel="Receipt">
          <Text style={{ color: colors.text, fontWeight: '700' }}>{closed ? 'Receipt' : 'Settlement so far'}</Text>
          <Row k="Final venue cost" v={gbp(state.venueCostMinor)} />
          <Row k="Expected venue payout" v={gbp(state.expectedVenuePayoutMinor)} />
          <Row k="Cash already received (deducted)" v={`- ${gbp(state.cashReceivedMinor)}`} />
          <Row k="Your own venue share (deducted)" v={`- ${gbp(state.organiserShareMinor)}`} />
          <Row k="Expected from online payments" v={gbp(state.expectedOnlinePayoutMinor)} />
          <Row k="Collected online" v={gbp(state.onlineCollectedMinor)} />
          <Row k={closed ? 'Paid out to you' : 'Payout on close'} v={gbp(state.payoutMinor)} bold />
          {state.shortfallMinor > 0 && <Row k="Shortfall against expected" v={gbp(state.shortfallMinor)} />}
          {closed && state.closedAt && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Closed {new Date(state.closedAt).toLocaleString()}</Text>}
        </View>
      )}

      {!!state.payoutError && !closed && <Text accessibilityRole="alert" style={{ color: colors.error }}>Payout did not complete: {state.payoutError} Review the figures and try Close again.</Text>}
      {!!notice && <Text accessibilityRole="alert" style={{ color: colors.warning }}>{notice}</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}

      {confirming && canCloseNow && (
        <View style={[card, { borderWidth: 2, borderColor: colors.text }]}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Are you sure you’re ready to close this event? You will be paid {gbp(state.payoutMinor)}.</Text>
          <Text style={{ color: colors.text }}>
            {state.shortfallMinor > 0 ? `This is ${gbp(state.shortfallMinor)} less than the expected value of your venue.` : 'This matches the expected payment value for your venue'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Cash already received and your own venue share are deducted. Closing releases the money to your connected Stripe account; when it reaches your bank depends on Stripe.</Text>
          <TouchableOpacity onPress={() => setAck((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: ack }} style={{ flexDirection: 'row', gap: 10, minHeight: 44, alignItems: 'center' }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: ack ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {ack && <Text style={{ color: colors.buttonText, fontWeight: '700' }}>x</Text>}
            </View>
            <Text style={{ color: colors.text, flex: 1 }}>I confirm all payments I expect from players have been paid.</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={close} disabled={!ack || busy} accessibilityRole="button" style={btn(true, !ack || busy)} testID="button-confirm-close">
            {busy ? <ActivityIndicator color={colors.buttonText} /> : <Text style={btnText(true)}>{status === 'closing' ? 'Retry close' : 'Close event'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setConfirming(false); setAck(false); }} disabled={busy} accessibilityRole="button" style={btn(false)}><Text style={btnText(false)}>Not yet</Text></TouchableOpacity>
        </View>
      )}

      {!closed && (
        <View style={{ gap: 10 }}>
          {!frozen ? (
            <>
              <TouchableOpacity onPress={save} disabled={!draftValid || !dirty || busy} accessibilityRole="button" style={btn(false, !draftValid || !dirty || busy)}><Text style={btnText(false)}>Save draft</Text></TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('Confirm players and cost', 'This refunds unused venue base to online players. Original fees are not refunded and you are not paid yet. The roster and cost will be frozen.', [
                  { text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: reconcile }])}
                disabled={!draftValid || dirty || busy || !state.canReconcile} accessibilityRole="button" style={btn(true, !draftValid || dirty || busy || !state.canReconcile)} testID="button-reconcile">
                {busy ? <ActivityIndicator color={colors.buttonText} /> : <Text style={btnText(true)}>Confirm players and cost</Text>}
              </TouchableOpacity>
              {dirty && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Save your draft before confirming.</Text>}
              {!state.canReconcile && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Finalise players after the event ends. You can record cash payments now.</Text>}
            </>
          ) : (
            <>
              <TouchableOpacity onPress={save} disabled={!dirty || cashInvalid || busy} accessibilityRole="button" style={btn(false, !dirty || cashInvalid || busy)}><Text style={btnText(false)}>Save cash updates and refund</Text></TouchableOpacity>
              {(refundPending || status === 'reconciling') && <TouchableOpacity onPress={reconcile} disabled={busy} accessibilityRole="button" style={btn(false, busy)}><Text style={btnText(false)}>Retry refunds</Text></TouchableOpacity>}
              {!confirming && (
                <TouchableOpacity onPress={() => { setConfirming(true); setNotice(''); }} disabled={!canCloseNow || busy} accessibilityRole="button" style={btn(true, !canCloseNow || busy)} testID="button-start-close">
                  <Text style={btnText(true)}>{status === 'closing' ? 'Retry close' : 'Close event'}</Text>
                </TouchableOpacity>
              )}
              {!canCloseNow && refundPending && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Close unlocks once all refunds succeed.</Text>}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}
