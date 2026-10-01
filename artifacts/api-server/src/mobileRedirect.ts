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

const GOOGLE_MOBILE_CALLBACK_PATH = "/api/auth/mobile/google/callback";

function configuredDevelopmentHosts(): string[] {
  const configured = [
    process.env.REPLIT_EXPO_DEV_DOMAIN,
    process.env.REPLIT_DEV_DOMAIN,
    ...(process.env.NODE_ENV === "production"
      ? []
      : (process.env.REPLIT_DOMAINS || "").split(",")),
  ];
  return configured
    .filter((host): host is string => Boolean(host))
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function configuredExpoHosts(): string[] {
  return [
    process.env.REPLIT_EXPO_DEV_DOMAIN,
    process.env.REPLIT_DEV_DOMAIN,
  ]
    .filter((host): host is string => Boolean(host))
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function configuredGoogleMobileCallback(): URL | undefined {
  const value = process.env.GOOGLE_MOBILE_CALLBACK_URL;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== GOOGLE_MOBILE_CALLBACK_PATH ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

function isAllowedGoogleHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.origin !== value
    ) {
      return false;
    }
    const configuredCallback = configuredGoogleMobileCallback();
    if (configuredCallback?.origin === url.origin) return true;
    return process.env.NODE_ENV !== "production" &&
      configuredDevelopmentHosts().includes(url.hostname);
  } catch {
    return false;
  }
}

// Browser OAuth may only return to the exact LUDI deep link, a configured
// development Expo Go callback, or a web callback on a trusted Replit origin.
export function isAllowedGoogleMobileRedirect(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value === "ludi-mobile:///auth/google/callback") return true;

  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.port
    ) {
      return false;
    }

    if (
      url.protocol === "exp:" &&
      process.env.NODE_ENV !== "production" &&
      configuredExpoHosts().includes(url.hostname.toLowerCase()) &&
      url.pathname === "/--/auth/google/callback"
    ) {
      return true;
    }

    const hasAllowedWebPath =
      url.pathname === "/auth/google/callback" ||
      url.pathname === "/ludi-mobile/auth/google/callback";
    return hasAllowedWebPath && isAllowedGoogleHttpsOrigin(url.origin);
  } catch {
    return false;
  }
}

export interface GoogleMobileCallbackRequest {
  protocol: string;
  hostname: string;
}

export function getGoogleMobileCallbackUrl(
  request: GoogleMobileCallbackRequest,
): string | undefined {
  const configuredUrl = process.env.GOOGLE_MOBILE_CALLBACK_URL;
  if (configuredUrl) {
    const url = configuredGoogleMobileCallback();
    return url ? `${url.origin}${GOOGLE_MOBILE_CALLBACK_PATH}` : undefined;
  }

  if (request.protocol !== "https" || !request.hostname) return undefined;
  const origin = `https://${request.hostname}`;
  if (!isAllowedGoogleHttpsOrigin(origin)) return undefined;
  return `${origin}${GOOGLE_MOBILE_CALLBACK_PATH}`;
}
