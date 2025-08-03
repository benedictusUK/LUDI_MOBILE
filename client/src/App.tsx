import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import LogoReveal from "@/components/ui/logo-reveal";
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

  // Show logo reveal when user becomes authenticated for the first time
  const shouldShowReveal = isAuthenticated && !isLoading && showLogoReveal && !hasShownReveal;

  return (
    <>
      {shouldShowReveal && (
        <LogoReveal onComplete={handleLogoRevealComplete} />
      )}
      
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
