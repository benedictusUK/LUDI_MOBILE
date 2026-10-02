import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { POLICY_OPTIONS, isFixedPolicy } from '../lib/paymentPolicy';

export default function PaymentPolicyFields({ formData, setFormData, colors }) {
  const fixed = isFixedPolicy(formData.paymentPolicy);
  const set = (k) => (v) => setFormData({ ...formData, [k]: v });
  const input = [styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder || colors.border, color: colors.inputText || colors.text }];
  const field = (label, key, placeholder, kb, hint) => (
    <>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
      <TextInput style={input} value={formData[key]} onChangeText={set(key)} placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholder} keyboardType={kb} autoCapitalize="none" />
    </>
  );
  const current = POLICY_OPTIONS.find((o) => o.value === formData.paymentPolicy);
  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>Payment mode (GBP only)</Text>
      <View style={styles.row}>
        {POLICY_OPTIONS.map((o) => {
          const active = o.value === formData.paymentPolicy;
          return (
            <TouchableOpacity key={o.value} onPress={() => set('paymentPolicy')(o.value)}
              style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' }]}>
              <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>{current?.help}</Text>
      {fixed ? (
        <>
          {field('Fixed price per player (GBP) *', 'fixedPrice', '10.00', 'decimal-pad', 'Players pay exactly this amount.')}
          {formData.paymentPolicy === 'fixed_threshold' && field('Minimum paid players *', 'minimumPaidParticipants', '8', 'number-pad')}
          {field(formData.paymentPolicy === 'fixed_threshold' ? 'Payment deadline * (YYYY-MM-DD HH:MM)' : 'Payment deadline (optional, defaults to start)', 'paymentDeadlineText', '2025-06-01 18:00', 'default')}
          {field('Payments open (optional, YYYY-MM-DD HH:MM)', 'authorizationOpensText', '', 'default')}
        </>
      ) : (
        <>
          {field('Max Player Payment (GBP) *', 'maxPlayerPayment', '20.00', 'decimal-pad')}
          {field('Final Venue Cost (GBP, optional)', 'finalVenueCost', '100.00', 'decimal-pad')}
          {field('Authorisation opens (optional, default 48h before)', 'authorizationOpensText', '', 'default')}
          {field('Collect by (optional, default end + 24h)', 'completionDueText', '', 'default')}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  hint: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
});
