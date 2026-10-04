import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function UpfrontSettlement({ event, attendance, onBack }) {
  const { apiRequest } = useAuth();
  const { colors } = useTheme();
  const [quote, setQuote] = useState(null);
  const [cost, setCost] = useState(event.finalVenueCost ?? event.cost ?? '0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const loadQuote = async () => {
    try {
      const response = await apiRequest(`/api/events/${event.id}/payment-policy`);
      if (!response.ok) throw new Error('Payment details could not be loaded');
      setQuote(await response.json()); setError('');
    } catch (e) { setError(e.message || 'Payment details could not be loaded'); }
  };
  useEffect(() => { loadQuote(); }, [event.id]);
  const count = attendance.filter(a => ['attending', 'promoted'].includes(a.status) && a.userId !== (event.venueOrganiserId || event.createdById)).length;
  const costMinor = /^\d+(?:\.\d{1,2})?$/.test(cost) ? Math.round(Number(cost) * 100) : NaN;
  const share = count ? Math.ceil(costMinor / count) : 0;
  const exceeds = quote && share > quote.baseAmountMinor;
  const money = n => `£${(n / 100).toFixed(2)}`;
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const response = await apiRequest(`/api/events/${event.id}/collect-payment`, {
        method: 'POST', body: JSON.stringify({ venueCost: cost }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Refunds could not complete');
      setResult(data);
    } catch (e) { setError(e.message || 'Refunds could not complete'); }
    finally { setBusy(false); }
  };
  const frozen = event.paymentCollectionInitiated || !!result;
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24, gap: 16 }}>
    <TouchableOpacity onPress={onBack} disabled={busy}><Text style={{ color: colors.primary }}>Back to event</Text></TouchableOpacity>
    <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Finalise venue cost</Text>
    <Text style={{ color: colors.text }}>{event.name}: payments have already been collected. Refund only unused venue cost. Both original fee amounts stay fixed.</Text>
    <Text style={{ color: colors.text }}>{count} registered paying participants. The original organiser and participant list are used.</Text>
    <Text style={{ color: colors.text }}>Final venue cost (£)</Text>
    <TextInput testID="input-final-venue-cost" value={cost} onChangeText={setCost} keyboardType="decimal-pad" editable={!frozen && !busy}
      style={{ borderWidth: 1, borderColor: colors.border, color: colors.text, padding: 12, borderRadius: 8 }} />
    {quote && Number.isFinite(costMinor) && count > 0 && <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text }}>Maximum originally paid: {money(quote.amountMinor)}</Text>
      <Text style={{ color: colors.text }}>Original platform charge: {money(quote.platformFeeMinor)}</Text>
      <Text style={{ color: colors.text }}>Original processing charge: {money(quote.processingFeeMinor)}</Text>
      <Text style={{ color: colors.text }}>Estimated final total: {money(share + quote.platformFeeMinor + quote.processingFeeMinor)}</Text>
      <Text style={{ color: colors.text }}>Estimated refund: {money(Math.max(0, quote.baseAmountMinor - share))}</Text>
      <Text style={{ color: colors.text }}>Exact penny allocation can make individual venue shares differ by 1p.</Text>
    </View>}
    {exceeds && <Text style={{ color: '#b91c1c' }}>Final share exceeds the agreed maximum. No extra payment will be taken.</Text>}
    {error ? <TouchableOpacity onPress={!quote ? loadQuote : undefined}><Text style={{ color: '#b91c1c' }}>{error}{!quote ? '. Tap to reload.' : ''}</Text></TouchableOpacity> : null}
    {result && <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text }}>{result.message}</Text>
      <Text style={{ color: colors.text }}>Refunded: £{result.totalRefunded}. Pending: {result.pendingRefunds}. Needs retry: {result.failedRefunds}.</Text>
    </View>}
    <TouchableOpacity testID="button-collect-payments" onPress={submit} disabled={busy || !quote || !count || !Number.isFinite(costMinor) || costMinor < 0 || exceeds || result?.settlementComplete}
      style={{ backgroundColor: colors.primary, padding: 16, borderRadius: 10, opacity: busy || !quote || exceeds || result?.settlementComplete ? 0.5 : 1 }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{frozen ? 'Retry residual refunds' : 'Confirm cost and refund residual'}</Text>}
    </TouchableOpacity>
  </ScrollView>;
}