import React, { useEffect, useState } from "react";
import { ArrowLeft, Bell, CalendarDays, Home, Search, Users, UserRound, X } from "lucide-react";
import { user, dashboardData } from "./fixtures";

// Minimal DOM adapters for the extracted React Native source. Layout, content
// and style values live in the unchanged copied screen, not a guessed recreation.
type NativeStyle = Record<string, any> | NativeStyle[] | false | undefined;
function css(style: NativeStyle): React.CSSProperties {
  const flat: Record<string, any> = {};
  function merge(value: NativeStyle) {
    if (Array.isArray(value)) value.forEach(merge);
    else if (value) Object.assign(flat, value);
  }
  merge(style);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (key === "paddingHorizontal") { result.paddingLeft = value; result.paddingRight = value; }
    else if (key === "paddingVertical") { result.paddingTop = value; result.paddingBottom = value; }
    else if (key === "marginHorizontal") { result.marginLeft = value; result.marginRight = value; }
    else if (key === "marginVertical") { result.marginTop = value; result.marginBottom = value; }
    else if (key === "borderWidth") { result.borderWidth = value; result.borderStyle = "solid"; }
    else if (/^border.*Width$/.test(key)) { result[key] = value; result.borderStyle = "solid"; }
    else if (key === "flex") result.flex = `${value} 1 0%`;
    else if (!["shadowColor", "shadowOffset", "shadowOpacity", "shadowRadius", "elevation"].includes(key)) result[key] = value;
  }
  if (flat.shadowRadius) result.boxShadow = `0 1px ${flat.shadowRadius * 2}px rgba(0,0,0,${flat.shadowOpacity ?? 0.1})`;
  return result as React.CSSProperties;
}
type Props = { style?: NativeStyle; children?: React.ReactNode; [key: string]: any };
export function View({ style, children }: Props) {
  return <div style={{ display: "flex", flexDirection: "column", boxSizing: "border-box", flexShrink: 0, ...css(style) }}>{children}</div>;
}
export function Text({ style, children }: Props) {
  return <div style={{ lineHeight: 1.25, ...css(style) }}>{children}</div>;
}
export function TouchableOpacity({ style, children, onPress, accessibilityRole }: Props) {
  return <button type="button" role={accessibilityRole} onClick={onPress}
    style={{ display: "flex", flexDirection: "column", flexShrink: 0, textAlign: "left", cursor: "pointer", ...css(style) }}>{children}</button>;
}
export function ScrollView({ style, children }: Props) {
  return <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", minHeight: 0, ...css(style) }}>{children}</div>;
}
export function LinearGradient({ style, colors, children }: Props) {
  return <View style={{ ...css(style), backgroundImage: `linear-gradient(135deg, ${colors.join(", ")})` }}>{children}</View>;
}
export function Image({ source, style, accessibilityLabel }: Props) {
  return <img src={source} alt={accessibilityLabel || ""} style={{ objectFit: "contain", ...css(style) }} />;
}
export const StyleSheet = { create: <T,>(styles: T): T => styles };
export const Platform = { OS: "ios" };
export function RefreshControl() { return null; }
export function Ionicons({ name, size, color }: Props) {
  const Icon = name === "arrow-back" ? ArrowLeft : Bell;
  return <Icon size={size} color={color} />;
}
const colors = {
  background: "#0f172a", card: "#1e293b", cardSecondary: "#334155",
  text: "#f1f5f9", textSecondary: "#94a3b8", border: "#334155",
  primary: "#3b82f6", primaryGreen: "#10b981", error: "#ef4444",
};
export const useTheme = () => ({ colors, isDark: true });
export const useAuth = () => ({ user, apiRequest: async () => ({ ok: true, json: async () => [{ isRead: false }, { isRead: false }] }) });
export const useDashboardData = () => ({ data: dashboardData, loading: false, error: null, reload: async () => {} });
export const useNotifications = () => ({ unreadCount: 2, updateUnreadCount: () => {} });
function navigate(screen: string) { window.dispatchEvent(new CustomEvent("ludi-preview-navigation", { detail: screen })); }
export const useNavigation = () => ({ navigate, getParent: () => ({ navigate }), goBack: () => {} });

export function SafeAreaView({ style, children }: Props) {
  const [screen, setScreen] = useState("");
  useEffect(() => {
    const listener = (event: Event) => setScreen((event as CustomEvent<string>).detail);
    window.addEventListener("ludi-preview-navigation", listener);
    return () => window.removeEventListener("ludi-preview-navigation", listener);
  }, []);
  return <div className="ludi-native-current" style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', ...css(style) }}>
    {children}
    <nav aria-label="Main navigation" style={{ display: "flex", flexShrink: 0, background: colors.card, height: 70, padding: "8px 0", borderTop: `1px solid ${colors.border}` }}>
      {[["Home", Home], ["Events", CalendarDays], ["Search", Search], ["Teams", Users], ["Profile", UserRound]].map(([label, Icon]: any) =>
        <button key={label} onClick={() => label !== "Home" && navigate(label)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: label === "Home" ? colors.primaryGreen : colors.textSecondary }}>
          <Icon size={24} /><span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
        </button>)}
    </nav>
    {screen && <div role="dialog" aria-modal="true" aria-label={`${screen} design preview`} style={{ position: "fixed", inset: 0, zIndex: 50, background: "#0f172aee", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ background: colors.card, color: colors.text, padding: 24, borderRadius: 16 }}>
        <button aria-label="Close preview" onClick={() => setScreen("")} style={{ float: "right" }}><X /></button>
        <h2 style={{ fontSize: 24 }}>{screen}</h2><p style={{ marginTop: 16 }}>Design preview only. No account data is changed.</p>
      </section>
    </div>}
  </div>;
}
