import React, { createContext, useContext } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { BrandText as Text, BrandTextInput } from '../../components/brand/BrandText';
import useBrandStyles from '../../components/brand/useBrandStyles';
import { useBrandTypography } from '../../components/home/brand';
import { KeyboardAwareScrollViewCompat } from '../../components/KeyboardAwareScrollViewCompat';

export const AdminGuardContext = createContext(null);
export const useAdminGuard = () => useContext(AdminGuardContext);

const base = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  btn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnLabel: { fontSize: 15, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 48 },
  inputMulti: { minHeight: 120, textAlignVertical: 'top' },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  body: { fontSize: 15, lineHeight: 21 },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center', marginRight: 8, marginBottom: 8 },
  chipLabel: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, marginRight: 8 },
  bannerBox: { borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  scrim: { flex: 1, justifyContent: 'center', padding: 20 },
});

export function useAdminStyles() {
  const s = useBrandStyles(base);
  const { colors } = useTheme();
  const { display } = useBrandTypography();
  return { s, colors, display };
}

export function Screen({ title, subtitle, onBack, backLabel = 'Back', right, children }) {
  const { s, colors, display } = useAdminStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={s.row}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[display, { fontSize: 28, color: colors.text }]} accessibilityRole="header">{title}</Text>
          </View>
          {right}
        </View>
        {subtitle ? <Text style={[s.hint, { color: colors.textSecondary, marginLeft: 52 }]}>{subtitle}</Text> : null}
      </View>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        bottomOffset={24}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
      >
        {children}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

export function Card({ children, style, accent }) {
  const { s, colors } = useAdminStyles();
  return <View style={[s.card, { backgroundColor: colors.card, borderColor: accent || colors.border }, style]}>{children}</View>;
}

export function SectionTitle({ children, hint }) {
  const { s, colors, display } = useAdminStyles();
  return (
    <View style={{ marginTop: 10, marginBottom: 10 }}>
      <Text accessibilityRole="header" style={[display, { fontSize: 22, color: colors.text }]}>{children}</Text>
      {hint ? <Text style={[s.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, style, testID }) {
  const { s, colors } = useAdminStyles();
  const off = disabled || loading;
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.error : colors.buttonSecondary;
  const fg = variant === 'secondary' ? colors.text : variant === 'danger' ? colors.buttonText : colors.buttonText;
  return (
    <Pressable
      testID={testID}
      disabled={!!off}
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [s.btn, { backgroundColor: off ? colors.disabled : bg, opacity: pressed ? 0.8 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} style={{ marginRight: 8 }} /> : icon ? <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} /> : null}
      <Text style={[s.btnLabel, { color: off ? colors.textSecondary : fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, error, multiline, style, ...rest }) {
  const { s, colors } = useAdminStyles();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <BrandTextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inputPlaceholder}
        multiline={multiline}
        style={[s.input, multiline && s.inputMulti, { backgroundColor: colors.inputBackground, borderColor: error ? colors.error : colors.inputBorder, color: colors.inputText }, style]}
        {...rest}
      />
      {error ? <Text style={[s.hint, { color: colors.error }]}>{error}</Text>
        : hint ? <Text style={[s.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function Banner({ tone = 'info', children, title, testID }) {
  const { s, colors } = useAdminStyles();
  const c = tone === 'error' ? colors.error : tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.info;
  return (
    <View testID={testID} accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite"
      style={[s.bannerBox, { borderColor: c, backgroundColor: colors.cardSecondary }]}>
      {title ? <Text style={[s.label, { color: c }]}>{title}</Text> : null}
      <Text style={[s.body, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, disabled }) {
  const { s, colors } = useAdminStyles();
  return (
    <Pressable disabled={!!disabled} onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={[s.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryLight : 'transparent', opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[s.chipLabel, { color: selected ? colors.primary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ToggleRow({ label, value, onValueChange, disabled, hint }) {
  const { s, colors } = useAdminStyles();
  return (
    <View style={[s.row, { minHeight: 48, marginBottom: 8 }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[s.label, { color: colors.text, marginBottom: 0 }]}>{label}</Text>
        {hint ? <Text style={[s.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled}
        accessibilityLabel={label} accessibilityState={{ checked: value, disabled: !!disabled }}
        trackColor={{ true: colors.primary, false: colors.disabled }} />
    </View>
  );
}

export function SkeletonBlocks({ count = 3, height = 110 }) {
  const { colors } = useAdminStyles();
  return (
    <View accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ height, borderRadius: 16, marginBottom: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderLight }} />
      ))}
    </View>
  );
}

export function LoadError({ title, message, onRetry, busy }) {
  return (
    <Card>
      <Banner tone="error" title={title}>{message}</Banner>
      <Button label="Try again" onPress={onRetry} loading={busy} variant="secondary" icon="refresh" />
    </Card>
  );
}

export function Confirm({ visible, title, message, confirmLabel, danger, busy, error, onConfirm, onCancel }) {
  const { s, colors, display } = useAdminStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[s.scrim, { backgroundColor: colors.overlay, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View accessibilityViewIsModal style={{ backgroundColor: colors.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text accessibilityRole="header" style={[display, { fontSize: 24, color: colors.text, marginBottom: 8 }]}>{title}</Text>
          <Text style={[s.body, { color: colors.text, marginBottom: 14 }]}>{message}</Text>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Button label={confirmLabel} onPress={onConfirm} loading={busy} variant={danger ? 'danger' : 'primary'} style={{ marginBottom: 10 }} />
          <Button label="Cancel" onPress={onCancel} variant="secondary" disabled={busy} />
        </View>
      </View>
    </Modal>
  );
}

