import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
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
import FlareSearch from "@/pages/flare-search";
import Teams from "@/pages/teams";
import Notifications from "@/pages/notifications";
import Settings from "@/pages/settings";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showInitialLoader, setShowInitialLoader] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [minimumLoadElapsed, setMinimumLoadElapsed] = useState(false);
  const [startupAttempt, setStartupAttempt] = useState(0);

  // Get user data when authenticated
  const userQuery = useQuery({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated && !isLoading,
  });

  // Preload dashboard data when authenticated
  const dashboardQuery = useQuery({
    queryKey: ["/api/dashboard/stats"],
    enabled: isAuthenticated && !isLoading,
  });

  const teamsQuery = useQuery({
    queryKey: ["/api/teams"],
    enabled: isAuthenticated && !isLoading,
  });

  const eventsQuery = useQuery({
    queryKey: ["/api/events"],
    enabled: isAuthenticated && !isLoading,
  });
  const user = userQuery.data;
  const teams = teamsQuery.data;
  const startupQueries = [userQuery, dashboardQuery, teamsQuery, eventsQuery];
  const startupPending = startupQueries.some(query => query.isPending);
  const startupFailed = startupQueries.some(query => query.isError && !query.data);

  // Preload team details for quick navigation
  useEffect(() => {
    if (isAuthenticated && !isLoading && initialLoadComplete && !startupFailed && teams) {
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
  }, [isAuthenticated, isLoading, teams, initialLoadComplete, startupFailed]);

  // Handle initial loading sequence
  useEffect(() => {
    setMinimumLoadElapsed(false);
    setShowInitialLoader(true);
    setInitialLoadComplete(false);
    if (!isAuthenticated || isLoading) return;
    // One minimum animation period, not a new timer after every query resolves.
    const timer = setTimeout(() => setMinimumLoadElapsed(true), 4000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, startupAttempt]);

  useEffect(() => {
    if (isAuthenticated && !isLoading && minimumLoadElapsed && !startupPending) {
      setShowInitialLoader(false);
      setInitialLoadComplete(true);
      // The initial loader has already played the logo animation. Do not play
      // a second reveal and add another four seconds before showing Home.
      sessionStorage.setItem('ludi-logo-revealed', 'true');
    }
  }, [isAuthenticated, isLoading, minimumLoadElapsed, startupPending]);

  // Check if profile needs to be completed
  const isProfileIncomplete = user && (!(user as any).username || !(user as any).dateOfBirth || !(user as any).postcode);

  // Show profile completion modal after logo reveal is complete
  useEffect(() => {
    if (isAuthenticated && !isLoading && initialLoadComplete && !startupFailed && isProfileIncomplete) {
      setShowProfileModal(true);
    }
  }, [isAuthenticated, isLoading, initialLoadComplete, isProfileIncomplete, startupFailed]);

  if (isAuthenticated && initialLoadComplete && startupFailed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div role="alert" className="max-w-md space-y-4 text-center text-foreground">
          <h1 className="text-xl font-semibold">We couldn’t load your events</h1>
          <p className="text-muted-foreground">Your data hasn’t been deleted. Please try again.</p>
          <button className="rounded-md bg-primary px-5 py-3 text-primary-foreground" onClick={() => {
            setStartupAttempt(attempt => attempt + 1);
            startupQueries.forEach(query => { void query.refetch(); });
          }}>Try again</button>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Show LUDI loader during initial data loading */}
      {isAuthenticated && !isLoading && showInitialLoader && (
        <LogoReveal holdUntilReady />
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
        ) : isAuthenticated && !isLoading ? (
          <>
            <Route path="/" component={Home} />
            <Route path="/events/new" component={Events} />
            <Route path="/events/:id" component={EventDetails} />
            <Route path="/events" component={Events} />
            <Route path="/flare-search" component={FlareSearch} />
            <Route path="/teams" component={Teams} />
            <Route path="/teams/:id" component={Teams} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/settings" component={Settings} />
          </>
        ) : null}
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
