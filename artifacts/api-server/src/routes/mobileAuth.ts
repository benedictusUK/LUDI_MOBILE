import { Router } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { verifyAppleMobileToken } from "../oauthProviders";
import { isAllowedMobileRedirect } from "../mobileRedirect";

// Extend session interface to include mobile redirect URI
declare module 'express-session' {
  interface SessionData {
    mobileRedirectUri?: string;
  }
}

const router = Router();

// JWT secret for mobile tokens
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'fallback-secret';

// Helper function to generate JWT token
function generateToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// Middleware to verify JWT token for mobile requests
export function verifyMobileToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
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
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      req.userId = decoded.userId;
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

// Google OAuth code exchange for mobile
router.post('/google/exchange', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Authorization code required' });
    }

    // Use the redirect_uri from the request, or fall back to Expo proxy
    const redirectUri = redirect_uri || 'https://auth.expo.io/@anonymous/ludi-mobile';

    console.log('Google code exchange - code:', code.substring(0, 20) + '...');
    console.log('Google code exchange - redirect_uri:', redirectUri);

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Google token exchange error:', error);
      return res.status(400).json({ message: 'Failed to exchange authorization code', error });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('Successfully got access token from Google');

    // Get user info from Google
    const userInfoResponse = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${accessToken}`
    );

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info from Google');
      return res.status(400).json({ message: 'Failed to get user info from Google' });
    }

    const userInfo = await userInfoResponse.json();
    console.log('Got user info from Google:', userInfo.email);

    // Create or update user
    const userData = {
      id: `google_${userInfo.id}`,
      email: userInfo.email,
      firstName: userInfo.given_name || null,
      lastName: userInfo.family_name || null,
      profileImageUrl: userInfo.picture || null,
      authProvider: 'google' as const,
    };

    const user = await storage.upsertAuthUser(userData);
    const token = generateToken(user.id);

    console.log('Created/updated user and generated JWT token');

    res.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error('Mobile Google code exchange error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
});

// Google OAuth direct token for mobile (legacy support)
router.post('/google', async (req, res) => {
  try {
    const { access_token, user_info } = req.body;

    if (!access_token || !user_info) {
      return res.status(400).json({ message: 'Access token and user info required' });
    }

    // Verify the access token with Google (optional additional security)
    const googleResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${access_token}`);
    if (!googleResponse.ok) {
      return res.status(400).json({ message: 'Invalid Google access token' });
    }

    // Create or update user
    const userData = {
      id: `google_${user_info.id}`,
      email: user_info.email,
      firstName: user_info.given_name || null,
      lastName: user_info.family_name || null,
      profileImageUrl: user_info.picture || null,
      authProvider: 'google' as const,
    };

    const user = await storage.upsertAuthUser(userData);
    const token = generateToken(user.id);

    res.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error('Mobile Google auth error:', error);
    res.status(500).json({ message: 'Authentication failed' });
  }
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