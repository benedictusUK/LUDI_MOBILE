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

  // Get user data when authenticated
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated && !isLoading,
  });

  // Show logo reveal only on first visit to authenticated app
  useEffect(() => {
    const hasSeenReveal = sessionStorage.getItem('ludi-logo-revealed');
    if (hasSeenReveal) {
      setShowLogoReveal(false);
      setHasShownReveal(true);
    }
  }, []);

  const handleLogoRevealComplete = () => {
    setShowLogoReveal(false);
    setHasShownReveal(true);
    sessionStorage.setItem('ludi-logo-revealed', 'true');
  };

  // Show logo reveal when user becomes authenticated for the first time (not loading states)
  const shouldShowReveal = isAuthenticated && !isLoading && showLogoReveal && !hasShownReveal;

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
        ) : (
          <>
            <Route path="/" component={Home} />
            <Route path="/events" component={Events} />
            <Route path="/events/:id" component={EventDetails} />
            <Route path="/teams" component={Teams} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/settings" component={Settings} />
          </>
        )}
        <Route component={NotFound} />
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
