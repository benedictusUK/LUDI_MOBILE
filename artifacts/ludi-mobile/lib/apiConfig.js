// Expo injects this domain for development and for Replit's production build.
// A custom API URL must be set explicitly for builds targeting another backend.
const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
const domain = process.env.EXPO_PUBLIC_DOMAIN;
const url = configuredUrl || (domain ? `https://${domain}` : null);

if (!url || !/^https:\/\//i.test(url)) {
  throw new Error('LUDI needs an HTTPS API URL (EXPO_PUBLIC_DOMAIN or EXPO_PUBLIC_API_URL).');
}

export const API_BASE_URL = url.replace(/\/+$/, '');