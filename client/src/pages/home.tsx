import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import Navigation from "@/components/ui/nav";
import DashboardStats from "@/components/ui/dashboard-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LudiInlineLoader } from "@/components/ui/ludi-loader";

export default function Home() {
  useScrollToTop();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  const { data: events = [] } = useQuery({
    queryKey: ["/api/events"],
  });

  // Filter to upcoming events only and sort by soonest first
  const upcomingEvents = (events as any[])
    .filter((event: any) => {
      const eventDate = new Date(event.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return eventDate >= today;
    })
    .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3);

  const userTeams = (teams as any[]).slice(0, 3);

  // Function to pre-load event data and navigate
  const handleEventClick = async (eventId: string) => {
    // Pre-load event details, attendance, and activity data
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["/api/events", eventId],
      }),
      queryClient.prefetchQuery({
        queryKey: ["/api/events", eventId, "attendance"],
      }),
      queryClient.prefetchQuery({
        queryKey: ["/api/events", eventId, "activity"],
      }),
    ]);
    
    setLocation(`/events/${eventId}`);
  };

  // Function to get voting status badge
  const getVotingStatusBadge = (event: any) => {
    if (!event.userAttendance) {
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Not Voted</Badge>;
    }
    
    switch (event.userAttendance.status) {
      case 'attending':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Can Attend</Badge>;
      case 'not_attending':
        return <Badge variant="destructive">Can't Attend</Badge>;
      case 'maybe':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">Maybe</Badge>;
      default:
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Not Voted</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">
            Welcome back, {(user as any)?.firstName || "User"}!
          </h1>
        </div>

        {/* Stats Grid */}
        <DashboardStats stats={stats as any} />



        {/* Upcoming Events & Teams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upcoming Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Upcoming Events</CardTitle>
              <Link href="/events">
                <Button variant="link" className="text-primary">View All</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingEvents.length === 0 ? (
                  <div className="text-center py-12">
                    <i className="fas fa-calendar text-neutral-300 text-6xl mb-4"></i>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">No upcoming events</h3>
                    <p className="text-neutral-500">Create an event to get started!</p>
                  </div>
                ) : (
                  upcomingEvents.map((event: any) => (
                    <div 
                      key={event.id} 
                      className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer"
                      onClick={() => handleEventClick(event.id)}
                    >
                      <div className="bg-primary p-3 rounded-lg">
                        <i className="fas fa-football-ball text-white"></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-neutral-900">{event.name}</h4>
                        <p className="text-sm text-neutral-500">
                          {new Date(event.startDate).toLocaleDateString()} • {event.startTime}
                        </p>
                        <p className="text-sm text-neutral-500">{event.location || "TBD"}</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        {getVotingStatusBadge(event)}
                        <span className="text-xs text-neutral-400">Click to vote</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Your Teams */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your Teams</CardTitle>
              <Link href="/teams">
                <Button variant="link" className="text-primary">View All Teams</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userTeams.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">No teams found</p>
                ) : (
                  userTeams.map((team: any) => (
                    <div 
                      key={team.id} 
                      className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-gray-200 transition-colors"
                      onClick={() => setLocation(`/teams/${team.id}`)}
                    >
                      <img 
                        src="https://pixabay.com/get/g5202462873eca9619d3df5dc0f91959d63be50f907aa2c040457382b8a99e807adb0e5247e5c503dc64ac68ca06a66f75cf609b2aa65f8cd9dfcf027f2207bfc_1280.jpg" 
                        alt={`${team.name} team`}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-neutral-900">{team.name}</h4>
                        <p className="text-sm text-neutral-500">{team.sport}</p>
                        <p className="text-sm text-neutral-500">{team.memberCount} members</p>
                      </div>
                      <Badge variant="outline" className={
                        team.role === "admin" ? "text-secondary" :
                        team.role === "captain" ? "text-primary" :
                        team.role === "coach" ? "text-purple-600" : "text-neutral-600"
                      }>
                        {team.role}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
