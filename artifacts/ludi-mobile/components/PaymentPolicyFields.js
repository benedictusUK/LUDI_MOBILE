import React, { useState } from 'react';
import useBrandStyles from './brand/useBrandStyles';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BrandText as Text, BrandTextInput as TextInput } from './brand/BrandText';
import { Ionicons } from '@expo/vector-icons';
import { POLICY_OPTIONS, isFixedPolicy } from '../lib/paymentPolicy';
import CalendarPickerModal from './CalendarPickerModal';

const fmtTime = (raw) => {
  let v = raw.replace(/[^\d]/g, '');
  if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2, 4);
  return v;
};

export default function PaymentPolicyFields({ formData, setFormData, colors }) {
  const styles = useBrandStyles(baseStyles);
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
  const [calKey, setCalKey] = useState(null);
  const split = (t) => { const [d = '', tm = ''] = (formData[t] || '').split(' '); return [d, tm]; };
  const join = (key, d, tm) => setFormData({ ...formData, [key]: d || tm ? `${d} ${tm || '00:00'}`.trim() : '' });
  const dateTimeField = (label, key, hint) => {
    const [d, tm] = split(key);
    return (
      <>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
        <View style={styles.dtRow}>
          <TouchableOpacity style={[input, styles.dtDate]} onPress={() => setCalKey(key)} testID={`button-${key}-date`}>
            <Text style={{ color: d ? (colors.inputText || colors.text) : colors.inputPlaceholder, fontSize: 16 }}>{d || 'Pick date'}</Text>
            <Ionicons name="calendar-outline" size={18} color={colors.icon || colors.text} />
          </TouchableOpacity>
          <TextInput style={[input, styles.dtTime]} value={tm} placeholder="HH:MM" keyboardType="number-pad" maxLength={5}
            placeholderTextColor={colors.inputPlaceholder} onChangeText={(v) => join(key, d, fmtTime(v))} testID={`input-${key}-time`} />
        </View>
        <CalendarPickerModal visible={calKey === key} title={label.replace(/ \*$/, '')} value={d} colors={colors}
          onSelect={(ymd) => join(key, ymd, tm)} onClear={d ? () => setFormData({ ...formData, [key]: '' }) : undefined}
          onClose={() => setCalKey(null)} />
      </>
    );
  };
  const offsetField = (label, daysKey, hoursKey, hint) => (
    <>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.dtRow}>
        <View style={styles.offsetCell}>
          <TextInput style={input} value={formData[daysKey]} onChangeText={(v) => set(daysKey)(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad" maxLength={2} testID={`input-${daysKey}`} />
          <Text style={[styles.unit, { color: colors.textSecondary }]}>days</Text>
        </View>
        <View style={styles.offsetCell}>
          <TextInput style={input} value={formData[hoursKey]} onChangeText={(v) => set(hoursKey)(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad" maxLength={2} testID={`input-${hoursKey}`} />
          <Text style={[styles.unit, { color: colors.textSecondary }]}>hours</Text>
        </View>
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 6 }]}>{hint}</Text>
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
          {dateTimeField(formData.paymentPolicy === 'fixed_threshold' ? 'Payment deadline *' : 'Payment deadline (optional, defaults to start)', 'paymentDeadlineText')}
          {dateTimeField('Payments open (optional)', 'authorizationOpensText')}
        </>
      ) : (
        <>
          {field('Max Player Payment (GBP) *', 'maxPlayerPayment', '20.00', 'decimal-pad')}
          {field('Final Venue Cost (GBP, optional)', 'finalVenueCost', '100.00', 'decimal-pad')}
          {offsetField('Authorisation opens before event start', 'opensDays', 'opensHours', 'Default 2 days, 0 hours before start.')}
          {offsetField('Collect by, after event end', 'collectDays', 'collectHours', 'Default 1 day, 0 hours after end. Hours 0-23; whole window up to 5 days.')}
        </>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  hint: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dtRow: { flexDirection: 'row', gap: 8 },
  dtDate: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dtTime: { width: 90, textAlign: 'center' },
  offsetCell: { flex: 1 },
  unit: { fontSize: 12, marginTop: 4 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
});
