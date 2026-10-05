// Measured from all 98 ANMF frame durations in the supplied WebP.
export const STARTUP_ANIMATION_DURATION_MS = 4950;

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
