// Only LUDI's native deep link (or this workspace's Expo Go link during
// development) may receive a mobile sign-in token.
export function isAllowedMobileRedirect(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (value === "ludi-mobile:///auth/replit/callback") return true;

    const developmentHosts = [
      process.env.REPLIT_EXPO_DEV_DOMAIN,
      process.env.REPLIT_DEV_DOMAIN,
    ].filter(Boolean);
    return process.env.NODE_ENV !== "production" &&
      developmentHosts.includes(url.hostname) &&
      (
        (url.protocol === "exp:" &&
          url.pathname === "/--/auth/replit/callback") ||
        (url.protocol === "https:" &&
          url.pathname === "/auth/replit/callback")
      );
  } catch {
    return false;
  }
}