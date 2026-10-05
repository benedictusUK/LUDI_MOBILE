import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { homePalette, useBrandTypography } from '../home/brand';

// Legacy slate/tailwind literals that still live inside screen style sheets.
function legacyMap(p, isDark) {
  const tint = isDark ? '#16324d' : '#e3eefb';
  return {
    '#f8fafc': p.background, '#f1f5f9': p.background, '#f9fafb': p.background, '#f3f4f6': p.background,
    '#0f172a': p.background, '#ffffff': p.surface, '#fff': p.surface, '#1e293b': isDark ? p.surface : p.text,
    '#e2e8f0': p.border, '#e5e7eb': p.border, '#d1d5db': p.border, '#cbd5e1': p.border, '#334155': p.border,
    '#374151': p.text, '#111827': p.text, '#64748b': p.muted, '#6b7280': p.muted, '#94a3b8': p.muted,
    '#3b82f6': p.mint, '#2563eb': p.mint, '#10b981': p.mint, '#059669': p.mint,
    '#eff6ff': tint, '#f0f9ff': tint, '#dbeafe': tint, '#ecfdf5': tint,
    '#fef3c7': isDark ? '#3b3329' : '#fff3d9', '#fffbeb': isDark ? '#3b3329' : '#fff3d9',
    '#fee2e2': isDark ? '#422b36' : '#fbe8e8', '#fef2f2': isDark ? '#422b36' : '#fbe8e8',
    '#d1fae5': isDark ? '#0d3a35' : '#dff3ec', '#dcfce7': isDark ? '#0d3a35' : '#dff3ec',
    '#f0fdf4': isDark ? '#0d3a35' : '#dff3ec',
    '#ef4444': isDark ? '#ff7a7a' : '#c93b3b', '#dc2626': isDark ? '#ff7a7a' : '#c93b3b',
    '#f59e0b': isDark ? '#ffd27a' : '#a8660a', '#d97706': isDark ? '#ffd27a' : '#a8660a', '#b45309': isDark ? '#ffd27a' : '#a8660a', '#92400e': isDark ? '#ffd27a' : '#a8660a', '#b91c1c': isDark ? '#ff7a7a' : '#c93b3b',
  };
}

const TOUCH = /(button|btn|cta|action|back|close|pill|chip|toggle|option|link|fab|tab|item|row)/i;
const TEXTY = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign'];

export function brandize(base, p, typography, isDark, clearance) {
  const map = legacyMap(p, isDark);
  const ink = isDark ? '#06231e' : '#ffffff';
  const out = {};
  Object.keys(base).forEach(key => {
    const st = { ...StyleSheet.flatten(base[key]) };
    const hadFixedSurface = typeof st.backgroundColor === 'string';
    Object.keys(st).forEach(prop => {
      if (!/color$/i.test(prop) || typeof st[prop] !== 'string') return;
      const lc = st[prop].toLowerCase();
      // The same old slate literal was used for both surfaces and ink.
      // Foreground text must not inherit the surface mapping in dark mode.
      if (prop === 'color' && ['#0f172a', '#1e293b', '#334155', '#374151', '#111827'].includes(lc)) {
        st[prop] = p.text;
        return;
      }
      if (prop === 'color' && (lc === '#fff' || lc === '#ffffff')) {
        if (isDark && /(button|btn|cta|chip|pill|toggle|option|selected|active)/i.test(key) && /text|label/i.test(key)) st[prop] = '#06231e';
        return;
      }
      const hit = map[lc];
      if (hit) st[prop] = hit;
    });
    const isText = st.fontSize != null || (st.color != null && st.backgroundColor == null && st.width == null && st.height == null && TEXTY.some(t => st[t] != null));
    const fixed = st.width != null || st.height != null;
    const isCard = hadFixedSurface && st.backgroundColor === p.surface && !fixed && st.borderRadius >= 10 && st.borderRadius <= 24 && !isText;
    if (isCard) {
      st.borderRadius = 16; st.borderWidth = st.borderWidth || 1; st.borderColor = st.borderColor || p.border;
      st.shadowOpacity = 0; st.elevation = 0;
    }
    // Filled brand button: dark ink on mint in dark mode, white on deep mint in light.
    if (st.backgroundColor === p.mint && !isText) {
      if (st.color) st.color = ink;
      if (st.borderRadius > 4 && st.borderRadius < 40) st.borderRadius = Math.max(st.borderRadius, 12);
    }
    if (isText && !/icon/i.test(key)) {
      const size = st.fontSize || 14;
      const w = String(st.fontWeight || '400');
      const heavy = w === 'bold' || parseInt(w, 10) >= 600;
      if (st.color === '#ffffff' && st.backgroundColor === undefined) { /* overlay text, keep */ }
      if (size >= 20 && heavy) {
        Object.assign(st, typography.display);
        if (typography.display.fontFamily) { st.fontWeight = 'normal'; st.fontSize = Math.round(size * 1.12); st.letterSpacing = st.letterSpacing || 0.3; st.fontStyle = 'italic'; }
      } else Object.assign(st, typography.body);
      if (st.lineHeight && st.fontSize > size) st.lineHeight = Math.round(st.lineHeight * 1.12);
    }
    if (!isText && TOUCH.test(key) && !/(radio|checkbox|indicator|badge|dot|thumb)/i.test(key) && st.borderRadius != null && st.minHeight == null) {
      if (st.height != null && st.height < 44 && st.width != null && st.width === st.height) { st.width = 44; st.height = 44; }
      else if (st.height == null && (st.padding != null || st.paddingVertical != null || st.backgroundColor != null || st.borderWidth)) st.minHeight = 44;
    }
    if (clearance && !isText && /(content|list|scroll)/i.test(key) && st.paddingBottom != null && st.width == null) st.paddingBottom = Math.max(st.paddingBottom, clearance);
    out[key] = st;
  });
  return out;
}

export default function useBrandStyles(base, options = {}) {
  const clearance = options.navClearance || 0;
  const { isDark } = useTheme();
  const typography = useBrandTypography();
  const loaded = !!typography.body.fontFamily;
  const sig = base && typeof base === 'object' ? JSON.stringify(base) : '';
  return useMemo(() => brandize(base, homePalette(isDark), typography, isDark, clearance),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig, isDark, loaded, clearance]);
}

// Top safe offset used by custom headers: web fallback is 67 minus whatever inset already applies.
export const webTopFallback = insetTop => (Platform.OS === 'web' ? Math.max(0, 67 - insetTop) : 0);
