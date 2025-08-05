import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { SiApple } from "react-icons/si";
import { SiReplit } from "react-icons/si";
import { useState } from "react";

interface OAuthButtonsProps {
  showReplit?: boolean;
  className?: string;
}

export function OAuthButtons({ showReplit = true, className = "" }: OAuthButtonsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleGoogleSignIn = () => {
    setIsLoading('google');
    window.location.href = '/api/auth/google';
  };

  const handleAppleSignIn = async () => {
    try {
      setIsLoading('apple');
      
      // Check if Apple Sign-In is available (requires HTTPS or localhost)
      if (!window.AppleID) {
        // Load Apple Sign-In SDK
        const script = document.createElement('script');
        script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
        script.async = true;
        document.body.appendChild(script);

        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }

      // Get Apple configuration
      const configResponse = await fetch('/api/auth/apple/config');
      const config = await configResponse.json();

      if (!config.clientId) {
        throw new Error('Apple Sign-In not configured');
      }

      // Initialize Apple Sign-In
      window.AppleID.auth.init({
        clientId: config.clientId,
        scope: 'name email',
        redirectURI: config.redirectURI,
        usePopup: true
      });

      // Sign in with Apple
      const response = await window.AppleID.auth.signIn();
      
      // Send the ID token to our backend
      const authResponse = await fetch('/api/auth/apple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: response.authorization.id_token,
        }),
      });

      if (authResponse.ok) {
        window.location.href = '/';
      } else {
        throw new Error('Apple sign-in failed');
      }

    } catch (error) {
      console.error('Apple Sign-In error:', error);
      alert('Apple Sign-In is not available. Please try another sign-in option.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleReplitSignIn = () => {
    setIsLoading('replit');
    window.location.href = '/api/login';
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Google Sign-In */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 border-gray-300 text-gray-700"
        onClick={handleGoogleSignIn}
        disabled={isLoading !== null}
      >
        {isLoading === 'google' ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-700 mr-3"></div>
        ) : (
          <FcGoogle className="mr-3 h-5 w-5" />
        )}
        Continue with Google
      </Button>

      {/* Apple Sign-In */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 text-base font-medium bg-black hover:bg-gray-900 border-black text-white"
        onClick={handleAppleSignIn}
        disabled={isLoading !== null}
      >
        {isLoading === 'apple' ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
        ) : (
          <SiApple className="mr-3 h-5 w-5" />
        )}
        Continue with Apple
      </Button>

      {/* Replit Sign-In (optional) */}
      {showReplit && (
        <Button
          type="button"
          variant="outline"
          className="w-full h-12 text-base font-medium bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-700"
          onClick={handleReplitSignIn}
          disabled={isLoading !== null}
        >
          {isLoading === 'replit' ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-700 mr-3"></div>
          ) : (
            <SiReplit className="mr-3 h-5 w-5" />
          )}
          Continue with Replit
        </Button>
      )}
    </div>
  );
}

// Extend Window interface for Apple Sign-In
declare global {
  interface Window {
    AppleID: {
      auth: {
        init: (config: any) => void;
        signIn: () => Promise<any>;
      };
    };
  }
}