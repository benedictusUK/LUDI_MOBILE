import React, { useEffect, useState } from 'react';
import useBrandStyles from './brand/useBrandStyles';
import { View, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { BrandText as Text } from './brand/BrandText';
import { Ionicons } from '@expo/vector-icons';
import { monthCells, parseYmd, toYmd } from '../lib/calendar';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// value / minDate: 'YYYY-MM-DD'. onSelect(ymd). onClear optional.
export default function CalendarPickerModal({ visible, title, value, minDate, onSelect, onClear, onClose, colors = {} }) {
  const styles = useBrandStyles(baseStyles);
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });

  useEffect(() => {
    if (visible) {
      const v = parseYmd(value) || { year: today.getFullYear(), month: today.getMonth() + 1 };
      setView({ year: v.year, month: v.month });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const shift = (delta) => {
    const d = new Date(view.year, view.month - 1 + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };
  const sel = parseYmd(value);
  const todayYmd = toYmd(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const bg = colors.card || colors.background || '#fff';
  const fg = colors.text || '#111';
  const accent = colors.primary || '#2563eb';
  const cells = monthCells(view.year, view.month);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: bg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: fg }]}>{title || 'Select date'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close calendar" testID="calendar-close">
              <Ionicons name="close" size={22} color={fg} />
            </TouchableOpacity>
          </View>
          <View style={styles.nav}>
            <TouchableOpacity onPress={() => shift(-1)} style={styles.navBtn} accessibilityLabel="Previous month" testID="calendar-prev">
              <Ionicons name="chevron-back" size={22} color={fg} />
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: fg }]}>{MONTH_NAMES[view.month - 1]} {view.year}</Text>
            <TouchableOpacity onPress={() => shift(1)} style={styles.navBtn} accessibilityLabel="Next month" testID="calendar-next">
              <Ionicons name="chevron-forward" size={22} color={fg} />
            </TouchableOpacity>
          </View>
          <View style={styles.week}>
            {WEEKDAYS.map((w, i) => <Text key={i} style={[styles.weekday, { color: colors.textSecondary || '#666' }]}>{w}</Text>)}
          </View>
          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const ymd = toYmd(view.year, view.month, d);
              const disabled = !!minDate && ymd < minDate;
              const selected = sel && ymd === toYmd(sel.year, sel.month, sel.day);
              return (
                <TouchableOpacity key={i} style={styles.cell} disabled={disabled} testID={`calendar-day-${ymd}`}
                  onPress={() => { onSelect(ymd); onClose(); }}>
                  <View style={[styles.dayBubble, selected && { backgroundColor: accent }, !selected && ymd === todayYmd && { borderWidth: 1, borderColor: accent }]}>
                    <Text style={{ color: selected ? (colors.buttonText || '#fff') : fg, opacity: disabled ? 0.3 : 1, fontWeight: selected ? '700' : '400' }}>{d}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          {onClear ? (
            <TouchableOpacity onPress={() => { onClear(); onClose(); }} style={styles.clear} testID="calendar-clear">
              <Text style={{ color: accent, fontWeight: '600' }}>Clear date</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 16, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  closeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  navBtn: { padding: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '600' },
  week: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  clear: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingTop: 12 },
});
