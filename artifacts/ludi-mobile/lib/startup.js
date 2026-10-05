// All 98 supplied WebP frames retained, with their timeline sped up 2×.
export const STARTUP_ANIMATION_DURATION_MS = 2475;

export function startupPhase({
  animationComplete, authLoading, authError, themeLoading, fontsReady,
  isAuthenticated, dashboardReady, dashboardError,
}) {
  if (!animationComplete) return 'animation';
  if (authLoading || themeLoading || !fontsReady) return 'waiting';
  if (authError) return 'error';
  if (!isAuthenticated) return 'login';
  if (dashboardError && !dashboardReady) return 'error';
  return dashboardReady ? 'home' : 'waiting';
}
