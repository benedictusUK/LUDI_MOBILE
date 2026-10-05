import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../contexts/ThemeContext';
import { homePalette, useBrandTypography } from './home/brand';

function nativeGlassSupported() {
  if (Platform.OS !== 'ios') return false;
  try { return isGlassEffectAPIAvailable() && isLiquidGlassAvailable(); }
  catch { return false; } // Older compiled clients may not include the native API.
}
const icons = { Home: 'home-outline', Events: 'calendar-outline', Search: 'search-outline', Teams: 'people-outline', Profile: 'shield-outline' };

export default function FloatingTabBar({ state, descriptors, navigation }) {
  const { isDark } = useTheme();
  const palette = homePalette(isDark);
  const typography = useBrandTypography();
  const insets = useSafeAreaInsets();
  const [reduceTransparency, setReduceTransparency] = useState(true);
  const [barHeight, setBarHeight] = useState(66);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preference = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-transparency: reduce)') : null;
      setReduceTransparency(preference ? preference.matches : true);
      const update = event => setReduceTransparency(event.matches);
      preference?.addEventListener?.('change', update);
      return () => preference?.removeEventListener?.('change', update);
    }
    if (Platform.OS !== 'ios' || typeof AccessibilityInfo.isReduceTransparencyEnabled !== 'function') return;
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (mounted) setReduceTransparency(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => { mounted = false; listener?.remove(); };
  }, []);
  const glass = !reduceTransparency && nativeGlassSupported();
  const blur = !reduceTransparency && (Platform.OS === 'ios' || Platform.OS === 'web');
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 12);
  const buttons = state.routes.map((route, index) => {
    const focused = state.index === index;
    const options = descriptors[route.key].options;
    return (
      <TouchableOpacity key={route.key} accessibilityRole="tab"
        accessibilityLabel={options.tabBarAccessibilityLabel || route.name}
        accessibilityState={{ selected: focused }} testID={`tab-${route.name.toLowerCase()}`}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={[styles.item, focused && { backgroundColor: isDark ? '#204765' : '#d1e8f5' }]}>
        <Ionicons name={icons[route.name] || 'ellipse-outline'} size={21} color={focused ? palette.mint : palette.text} />
        <Text style={[typography.body, styles.label, { color: palette.text }]}>{route.name}</Text>
      </TouchableOpacity>
    );
  });
  const content = <View style={styles.row}>{buttons}</View>;
  return (
    <View style={{ height: barHeight + 16 + bottom, backgroundColor: palette.background }}>
      <View onLayout={event => setBarHeight(Math.ceil(event.nativeEvent.layout.height))}
        style={[styles.pill, { bottom, borderColor: palette.border }]} testID="floating-tab-bar">
        {glass ? <GlassView glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'}
          tintColor={isDark ? '#102943' : '#edf4fa'} style={styles.material}>{content}</GlassView>
          : blur ? <BlurView tint={isDark ? 'dark' : 'light'} intensity={70} style={[styles.material, { backgroundColor: isDark ? '#102943bb' : '#edf4fadd' }]}>{content}</BlurView>
          : <View style={[styles.material, { backgroundColor: palette.surface }]}>{content}</View>}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  pill: { position: 'absolute', left: 12, right: 12, borderWidth: 1, borderRadius: 24, overflow: 'hidden', elevation: 6 },
  material: { borderRadius: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', padding: 7, gap: 3 },
  item: { flex: 1, minHeight: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 10, fontWeight: '600' },
});
