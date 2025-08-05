import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import LogoReveal from "@/components/ui/logo-reveal";
import { OAuthButtons } from "@/components/ui/oauth-buttons";

export default function Landing() {
  const [showLogoReveal, setShowLogoReveal] = useState(true);
  const [hasShownReveal, setHasShownReveal] = useState(false);

  // Show logo reveal on first visit to landing page
  useEffect(() => {
    const hasSeenLandingReveal = sessionStorage.getItem('ludi-landing-revealed');
    if (hasSeenLandingReveal) {
      setShowLogoReveal(false);
      setHasShownReveal(true);
    }
  }, []);

  const handleLogoRevealComplete = () => {
    setShowLogoReveal(false);
    setHasShownReveal(true);
    sessionStorage.setItem('ludi-landing-revealed', 'true');
  };

  const shouldShowReveal = showLogoReveal && !hasShownReveal;

  return (
    <>
      {shouldShowReveal && (
        <LogoReveal onComplete={handleLogoRevealComplete} />
      )}
      
      <div style={{ display: shouldShowReveal ? 'none' : 'block' }}>
        <div className="min-h-screen bg-gradient-to-br from-primary to-blue-800 text-white">
          {/* Navigation */}
          <nav className="bg-white/10 backdrop-blur-sm border-b border-white/20 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <div className="flex-shrink-0 flex items-center">
                    <i className="fas fa-trophy text-white text-2xl mr-3"></i>
                    <span className="text-xl font-bold text-white tracking-wider">LUDI</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => window.location.href = '/api/login'} variant="secondary" size="sm">
                    Sign In
                  </Button>
                  <Button onClick={() => window.location.href = '/api/login'} variant="outline" size="sm" className="border-white text-white hover:bg-white hover:text-primary">
                    Join
                  </Button>
                </div>
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h1 className="text-4xl lg:text-6xl font-bold mb-4 leading-tight tracking-wider">
                    LUDI
                  </h1>
                  <p className="text-2xl font-medium mb-4 text-blue-100">
                    Don't just watch
                  </p>
                  <p className="text-xl mb-8 text-blue-100">
                    Create events, manage teams, coordinate schedules, and engage your sports community all in one powerful platform.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 max-w-md">
                    <Button 
                      onClick={() => window.location.href = '/api/login'} 
                      size="lg" 
                      variant="secondary"
                      className="flex-1"
                    >
                      Sign In
                    </Button>
                    <Button 
                      onClick={() => window.location.href = '/api/login'} 
                      size="lg" 
                      variant="outline" 
                      className="border-white text-white hover:bg-white hover:text-primary flex-1"
                    >
                      Create Account
                    </Button>
                  </div>
                  <p className="text-sm text-blue-200 mt-3 max-w-md">
                    New to LUDI? Click "Create Account" to get started. Both options will guide you through setting up your sports profile.
                  </p>
                </div>
                <div className="relative">
                  <img 
                    src="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                    alt="Sports team in action" 
                    className="rounded-2xl shadow-2xl w-full h-auto"
                  />
                  <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-lg">
                    <div className="flex items-center space-x-4">
                      <div className="bg-secondary p-3 rounded-lg">
                        <i className="fas fa-users text-white text-xl"></i>
                      </div>
                      <div>
                        <p className="text-neutral-900 font-semibold">1,200+</p>
                        <p className="text-neutral-500 text-sm">Active Teams</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20 bg-white/10 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything You Need</h2>
                <p className="text-xl text-blue-100">Powerful features for sports management</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center p-6">
                  <div className="bg-white/20 p-4 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <i className="fas fa-calendar text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Event Management</h3>
                  <p className="text-blue-100">Create and manage sports events with ease</p>
                </div>
                
                <div className="text-center p-6">
                  <div className="bg-white/20 p-4 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <i className="fas fa-users text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Team Coordination</h3>
                  <p className="text-blue-100">Organize teams and manage memberships</p>
                </div>
                
                <div className="text-center p-6">
                  <div className="bg-white/20 p-4 rounded-lg w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <i className="fas fa-bell text-2xl"></i>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Smart Notifications</h3>
                  <p className="text-blue-100">Stay updated with real-time alerts</p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-12 border-t border-white/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <i className="fas fa-trophy text-white text-2xl mr-3"></i>
                  <span className="text-xl font-bold tracking-wider">LUDI</span>
                </div>
                <p className="text-blue-100 mb-6">
                  Don't just watch - The complete sports event management platform for teams, organizers, and athletes.
                </p>
                <p className="text-blue-200 text-sm">© 2024 LUDI. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}