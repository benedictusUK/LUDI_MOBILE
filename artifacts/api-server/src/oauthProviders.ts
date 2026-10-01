import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import appleSignin from "apple-signin-auth";
import type { Express } from "express";
import { storage } from "./storage";
import { nanoid } from "nanoid";

// Google OAuth Strategy
export function setupGoogleOAuth() {
  // Skip Google OAuth setup if credentials are not provided
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log("Google OAuth credentials not found, skipping Google authentication setup");
    return;
  }

  passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
  }, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error("No email found in Google profile"));
      }

      // Create or update user
      const userData = {
        id: `google_${profile.id}`,
        email: email,
        firstName: profile.name?.givenName || null,
        lastName: profile.name?.familyName || null,
        profileImageUrl: profile.photos?.[0]?.value || null,
        authProvider: 'google' as const,
      };

      const user = await storage.upsertAuthUser(userData);
      
      // Create a session-compatible user object
      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl,
        },
        provider: 'google'
      };

      return done(null, sessionUser);
    } catch (error) {
      return done(error);
    }
  }));
}

export { verifyAppleMobileToken } from "./appleMobileAuth";

export async function verifyAppleToken(idToken: string) {
  try {
    const { sub: userAppleId, email } = await appleSignin.verifyIdToken(idToken, {
      audience: process.env.APPLE_CLIENT_ID!,
      ignoreExpiration: false
    });

    if (!email) {
      throw new Error("No email found in Apple ID token");
    }

    // Create or update user
    const userData = {
      id: `apple_${userAppleId}`,
      email: email,
      firstName: undefined, // Apple doesn't always provide names
      lastName: undefined,
      profileImageUrl: undefined,
      authProvider: 'apple' as const,
    };

    const user = await storage.upsertAuthUser(userData);
    
    // Create a session-compatible user object
    const sessionUser = {
      claims: {
        sub: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        profile_image_url: user.profileImageUrl,
      },
      provider: 'apple'
    };

    return sessionUser;
  } catch (error) {
    throw new Error(`Apple token verification failed: ${error}`);
  }
}

export function setupOAuthRoutes(app: Express) {
  // Google OAuth routes (only if credentials are available)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get('/api/auth/google', 
      passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    app.get('/api/auth/google/callback',
      passport.authenticate('google', { failureRedirect: '/?error=google_auth_failed' }),
      (req, res) => {
        // Successful authentication, redirect to home
        res.redirect('/');
      }
    );
  }

  // Apple OAuth routes (only if credentials are available)
  if (process.env.APPLE_CLIENT_ID) {
    app.post('/api/auth/apple', async (req, res) => {
      try {
        const { id_token } = req.body;
        
        if (!id_token) {
          return res.status(400).json({ message: "Apple ID token is required" });
        }

        const sessionUser = await verifyAppleToken(id_token);
        
        // Manually log in the user
        req.login(sessionUser, (err) => {
          if (err) {
            console.error("Error logging in Apple user:", err);
            return res.status(500).json({ message: "Failed to log in user" });
          }
          
          res.json({ success: true, message: "Apple sign-in successful" });
        });

      } catch (error) {
        console.error("Apple sign-in error:", error);
        res.status(400).json({ message: "Apple sign-in failed" });
      }
    });

    // Apple Sign-In client configuration endpoint
    app.get('/api/auth/apple/config', (req, res) => {
      res.json({
        clientId: process.env.APPLE_CLIENT_ID,
        redirectURI: `${req.protocol}://${req.get('host')}/api/auth/apple/callback`,
        scope: 'name email'
      });
    });
  }
}