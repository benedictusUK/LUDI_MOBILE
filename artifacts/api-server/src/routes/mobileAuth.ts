import { Router } from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import { storage } from "../storage";
import { verifyAppleMobileToken } from "../oauthProviders";
import {
  getGoogleMobileCallbackUrl,
  isAllowedGoogleMobileRedirect,
  isAllowedMobileRedirect,
} from "../mobileRedirect";
import {
  createGoogleMobileHandoff,
  isValidGooglePkceChallenge,
  verifyGoogleMobileHandoff,
} from "../googleMobileHandoff";
import { getNormalMobileTokenUserId } from "../mobileToken";

interface GoogleMobileLoginAttempt {
  redirectUri: string;
  codeChallenge: string;
  appState: string;
  callbackUrl: string;
  createdAt: number;
}

// Extend session interface to include mobile redirect URI
declare module 'express-session' {
  interface SessionData {
    mobileRedirectUri?: string;
    googleMobileLogin?: GoogleMobileLoginAttempt;
  }
}

const router = Router();

// JWT secret for mobile tokens
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'fallback-secret';

// Helper function to generate JWT token
function generateToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

const GOOGLE_MOBILE_LOGIN_TTL_MS = 5 * 60 * 1000;
const GOOGLE_MOBILE_APP_STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function redirectGoogleMobileError(
  res: any,
  attempt: GoogleMobileLoginAttempt | undefined,
  error: string,
) {
  if (!attempt || !isAllowedGoogleMobileRedirect(attempt.redirectUri)) {
    return res.status(400).json({ message: "Google sign-in could not be completed" });
  }
  const destination = new URL(attempt.redirectUri);
  destination.searchParams.set("error", error);
  if (GOOGLE_MOBILE_APP_STATE_PATTERN.test(attempt.appState)) {
    destination.searchParams.set("state", attempt.appState);
  }
  return res.redirect(destination.href);
}

router.get('/google/config', (_req, res) => {
  return res.json({
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
});

// Middleware to verify JWT token for mobile requests
export function verifyMobileToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const userId = getNormalMobileTokenUserId(jwt.verify(token, JWT_SECRET));
    if (!userId) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.userId = userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Dual authentication middleware: supports both web sessions AND mobile JWT tokens
export function verifyAuth(req: any, res: any, next: any) {
  // Try mobile JWT token first
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    try {
      const userId = getNormalMobileTokenUserId(jwt.verify(token, JWT_SECRET));
      if (!userId) {
        throw new Error("Invalid application token");
      }
      req.userId = userId;
      return next();
    } catch (error) {
      // Invalid token, fall through to session check
    }
  }
  
  // Fall back to web session authentication
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    req.userId = req.user.claims.sub;
    return next();
  }
  
  // No valid authentication found
  return res.status(401).json({ message: 'Unauthorized' });
}

// Browser-based Google OAuth keeps all app redirect and PKCE inputs in the
// server-side session. Passport's Google strategy independently verifies its
// OAuth state parameter before this callback is reached.
router.get('/google/start', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      message: "Google browser sign-in is unavailable until GOOGLE_CLIENT_SECRET is configured",
    });
  }

  const redirectUri = queryString(req.query.redirect_uri);
  const codeChallenge = queryString(req.query.code_challenge);
  const appState = queryString(req.query.state);
  if (
    !isAllowedGoogleMobileRedirect(redirectUri) ||
    !isValidGooglePkceChallenge(codeChallenge) ||
    !appState ||
    !GOOGLE_MOBILE_APP_STATE_PATTERN.test(appState)
  ) {
    return res.status(400).json({ message: "Invalid Google sign-in parameters" });
  }

  const callbackUrl = getGoogleMobileCallbackUrl(req);
  if (!callbackUrl) {
    return res.status(503).json({
      message: "Google browser sign-in callback URL is not configured for a trusted HTTPS origin",
    });
  }

  const attempt: GoogleMobileLoginAttempt = {
    redirectUri,
    codeChallenge,
    appState,
    callbackUrl,
    createdAt: Date.now(),
  };
  req.session.googleMobileLogin = attempt;

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    callbackURL: callbackUrl,
  } as any)(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  const attempt = req.session?.googleMobileLogin;
  if (req.session) delete req.session.googleMobileLogin;
  if (!attempt || !isAllowedGoogleMobileRedirect(attempt.redirectUri)) {
    return res.status(400).json({ message: "Google sign-in session is missing or invalid" });
  }

  const appState = GOOGLE_MOBILE_APP_STATE_PATTERN.test(attempt.appState)
    ? attempt.appState
    : "";
  const safeAttempt = { ...attempt, appState };
  const attemptAge = Date.now() - attempt.createdAt;
  if (
    !appState ||
    !Number.isFinite(attempt.createdAt) ||
    attemptAge > GOOGLE_MOBILE_LOGIN_TTL_MS ||
    attemptAge < -30_000 ||
    !isValidGooglePkceChallenge(attempt.codeChallenge) ||
    !getGoogleMobileCallbackUrlFromStoredValue(attempt.callbackUrl)
  ) {
    return redirectGoogleMobileError(res, safeAttempt, "auth_expired");
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return redirectGoogleMobileError(res, safeAttempt, "google_unavailable");
  }

  return passport.authenticate(
    'google',
    {
      callbackURL: attempt.callbackUrl,
      session: false,
    } as any,
    async (error: unknown, authenticatedUser: any) => {
      if (error || authenticatedUser?.provider !== "google") {
        const isCancellation = queryString(req.query.error) === "access_denied";
        return redirectGoogleMobileError(
          res,
          safeAttempt,
          isCancellation ? "cancelled" : "auth_failed",
        );
      }

      const subject = authenticatedUser?.claims?.sub;
      if (typeof subject !== "string" || !subject) {
        return redirectGoogleMobileError(res, safeAttempt, "auth_failed");
      }

      try {
        const user = await storage.getUserById(subject);
        if (!user) {
          return redirectGoogleMobileError(res, safeAttempt, "auth_failed");
        }
        const ticket = createGoogleMobileHandoff(
          subject,
          attempt.codeChallenge,
          JWT_SECRET,
        );
        const destination = new URL(attempt.redirectUri);
        destination.searchParams.set("ticket", ticket);
        destination.searchParams.set("state", appState);
        return res.redirect(destination.href);
      } catch {
        return redirectGoogleMobileError(res, safeAttempt, "server_error");
      }
    },
  )(req, res, next);
});

function getGoogleMobileCallbackUrlFromStoredValue(value: string): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/api/auth/mobile/google/callback" ||
      url.search ||
      url.hash ||
      !isAllowedGoogleMobileRedirect(
        `${url.origin}/auth/google/callback`,
      )
    ) {
      return undefined;
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

router.post('/google/complete', async (req, res) => {
  const ticket = req.body?.ticket;
  const codeVerifier = req.body?.code_verifier;
  if (typeof ticket !== "string" || typeof codeVerifier !== "string") {
    return res.status(400).json({
      message: "Google handoff ticket and PKCE code verifier are required",
    });
  }

  const subject = verifyGoogleMobileHandoff(ticket, codeVerifier, JWT_SECRET);
  if (!subject) {
    return res.status(401).json({ message: "Invalid or expired Google handoff ticket" });
  }

  try {
    const user = await storage.getUserById(subject);
    if (!user) {
      return res.status(401).json({ message: "Google account is no longer available" });
    }
    return res.json({
      success: true,
      token: generateToken(user.id),
      user,
    });
  } catch {
    return res.status(500).json({ message: "Google sign-in could not be completed" });
  }
});

// Retired legacy Google code exchange; browser OAuth with PKCE is supported.
router.post('/google/exchange', (_req, res) => {
  return res.status(410).json({
    message: 'Use the supported browser-based Google sign-in',
  });
});

// Retired legacy client-profile Google sign-in; identity must come from the
// provider-authenticated browser flow.
router.post('/google', (_req, res) => {
  return res.status(410).json({
    message: 'Use the supported browser-based Google sign-in',
  });
});

// Apple OAuth for mobile
router.post('/apple', async (req, res) => {
  try {
    const { identity_token, user_info } = req.body;

    if (typeof identity_token !== 'string' || !identity_token) {
      return res.status(400).json({ message: 'Apple identity token required' });
    }

    let applePayload;
    try {
      applePayload = await verifyAppleMobileToken(identity_token);
    } catch (error) {
      console.error('Apple identity token verification failed:', error);
      return res.status(401).json({ message: 'Invalid or expired Apple identity token' });
    }

    // Apple may omit email on subsequent sign-ins. Never trust email supplied
    // by the client; an existing account already has its verified address.
    const userId = `apple_${applePayload.sub}`;
    const existingUser = await storage.getUserById(userId);
    const email = applePayload.email || existingUser?.email || null;

    if (!email) {
      return res.status(400).json({
        message: 'Apple did not provide an email address for this account',
      });
    }

    // Create or update user
    const userData = {
      id: userId,
      email: email,
      firstName: user_info?.fullName?.givenName || undefined,
      lastName: user_info?.fullName?.familyName || undefined,
      profileImageUrl: undefined,
      authProvider: 'apple' as const,
    };

    const user = await storage.upsertAuthUser(userData);
    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error('Mobile Apple auth error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
});

// Replit OAuth redirect for mobile
router.get('/replit/login', (req, res) => {
  const redirectUri = req.query.redirect_uri;
  
  if (!isAllowedMobileRedirect(redirectUri)) {
    return res.status(400).json({ message: 'Invalid mobile redirect URI' });
  }

  // Store the mobile redirect URI in session
  req.session.mobileRedirectUri = redirectUri;
  
  // Redirect to regular Replit OAuth
  res.redirect('/api/login');
});

// Enhanced callback that supports mobile redirects
router.get('/replit/callback', async (req, res) => {
  const user = req.user as any;
  const mobileRedirectUri = req.session?.mobileRedirectUri;
  if (mobileRedirectUri && !isAllowedMobileRedirect(mobileRedirectUri)) {
    return res.status(400).json({ message: 'Invalid mobile redirect URI' });
  }

  if (!user || !user.claims) {
    const error = mobileRedirectUri ? 
      `${mobileRedirectUri}?error=auth_failed` : 
      '/?error=auth_failed';
    return res.redirect(error);
  }

  try {
    // Get user from database
    const dbUser = await storage.getUserById(user.claims.sub);
    
    if (mobileRedirectUri && dbUser) {
      // Generate token for mobile app
      const token = generateToken(dbUser.id);
      const callbackUrl = `${mobileRedirectUri}?token=${token}&user_id=${dbUser.id}`;
      return res.redirect(callbackUrl);
    }

    // Regular web redirect
    res.redirect('/');
  } catch (error) {
    console.error('Replit callback error:', error);
    const errorUrl = mobileRedirectUri ? 
      `${mobileRedirectUri}?error=server_error` : 
      '/?error=server_error';
    res.redirect(errorUrl);
  }
});

export default router;