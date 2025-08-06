import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import LogoReveal from "@/components/ui/logo-reveal";
import { ProfileCompletionModal } from "@/components/ui/profile-completion-modal";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Events from "@/pages/events";
import EventDetails from "@/pages/event-details";
import Teams from "@/pages/teams";
import Notifications from "@/pages/notifications";
import Settings from "@/pages/settings";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showLogoReveal, setShowLogoReveal] = useState(true);
  const [hasShownReveal, setHasShownReveal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showInitialLoader, setShowInitialLoader] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Get user data when authenticated
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated && !isLoading,
  });

  // Preload dashboard data when authenticated
  const { data: dashboardStats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    enabled: isAuthenticated && !isLoading,
  });

  const { data: teams } = useQuery({
    queryKey: ["/api/teams"],
    enabled: isAuthenticated && !isLoading,
  });

  const { data: events } = useQuery({
    queryKey: ["/api/events"],
    enabled: isAuthenticated && !isLoading,
  });

  // Preload team details for quick navigation
  useEffect(() => {
    if (isAuthenticated && !isLoading && teams) {
      // Preload team members and details for all user's teams during app startup
      (teams as any[]).forEach((team: any) => {
        queryClient.prefetchQuery({
          queryKey: ["/api/teams", team.id, "members"],
          staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        });
        queryClient.prefetchQuery({
          queryKey: ["/api/teams", team.id],
          staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        });
      });
    }
  }, [isAuthenticated, isLoading, teams]);

  // Handle initial loading sequence
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Show LUDI loader for minimum duration to preload data
      const minLoadTime = 4000; // 4 seconds minimum to allow full animation including underline
      const startTime = Date.now();
      
      const checkDataLoaded = () => {
        const dataLoaded = user && dashboardStats && teams && events;
        const elapsedTime = Date.now() - startTime;
        
        if (dataLoaded && elapsedTime >= minLoadTime) {
          setShowInitialLoader(false);
          setInitialLoadComplete(true);
          
          // Check if we should show logo reveal
          const hasSeenReveal = sessionStorage.getItem('ludi-logo-revealed');
          if (!hasSeenReveal) {
            setShowLogoReveal(true);
            setHasShownReveal(false);
          } else {
            setShowLogoReveal(false);
            setHasShownReveal(true);
          }
        } else {
          // Check again in 100ms
          setTimeout(checkDataLoaded, 100);
        }
      };
      
      checkDataLoaded();
    }
  }, [isAuthenticated, isLoading, user, dashboardStats, teams, events]);

  const handleLogoRevealComplete = () => {
    // Add a small delay to ensure the animation completes fully
    setTimeout(() => {
      setShowLogoReveal(false);
      setHasShownReveal(true);
      sessionStorage.setItem('ludi-logo-revealed', 'true');
    }, 500); // Half second delay to ensure animation completes
  };

  // Show logo reveal after initial loading is complete
  const shouldShowReveal = isAuthenticated && !isLoading && initialLoadComplete && showLogoReveal && !hasShownReveal;

  // Check if profile needs to be completed
  const isProfileIncomplete = user && (!(user as any).username || !(user as any).dateOfBirth || !(user as any).postcode);

  // Show profile completion modal after logo reveal is complete
  useEffect(() => {
    if (isAuthenticated && !isLoading && hasShownReveal && isProfileIncomplete) {
      setShowProfileModal(true);
    }
  }, [isAuthenticated, isLoading, hasShownReveal, isProfileIncomplete]);

  return (
    <>
      {/* Show LUDI loader during initial data loading */}
      {isAuthenticated && !isLoading && showInitialLoader && (
        <LogoReveal onComplete={() => {}} skipAnimation={false} />
      )}

      {shouldShowReveal && (
        <LogoReveal onComplete={handleLogoRevealComplete} />
      )}
      
      {/* Profile completion modal */}
      <ProfileCompletionModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
      />
      
      <Switch>
        {isLoading || !isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : initialLoadComplete && hasShownReveal ? (
          <>
            <Route path="/" component={Home} />
            <Route path="/events" component={Events} />
            <Route path="/events/:id" component={EventDetails} />
            <Route path="/teams" component={Teams} />
            <Route path="/teams/:id" component={Teams} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/settings" component={Settings} />
          </>
        ) : null}
        {isLoading || !isAuthenticated ? <Route component={NotFound} /> : null}
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
