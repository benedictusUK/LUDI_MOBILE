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
import { 
  Users, Trophy, Target, Dumbbell, Zap, Mountain, 
  Bike, Waves, Heart, Music, Flag, Swords, Circle,
  Hexagon, Pentagon, Square
} from "lucide-react";

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

  // Custom SVG sport icons
  const FootballIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 2c-4.411 0-8 3.589-8 8s3.589 8 8 8 8-3.589 8-8-3.589-8-8-8z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
      <path d="M12 7l1.5 3h3l-2.5 2 1 3L12 13l-3 2 1-3-2.5-2h3L12 7z" fill="none" stroke="currentColor" strokeWidth="0.8"/>
    </svg>
  );

  const RugbyIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <ellipse cx="12" cy="12" rx="8" ry="10" fill="currentColor" />
      <path d="M8 12h8M10 8h4M10 16h4" stroke="white" strokeWidth="1" fill="none"/>
    </svg>
  );

  const TennisIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M4.5 12c0-4 3.5-7.5 7.5-7.5s7.5 3.5 7.5 7.5-3.5 7.5-7.5 7.5-7.5-3.5-7.5-7.5z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
      <path d="M12 3.5v17M3.5 12h17" stroke="currentColor" strokeWidth="0.5"/>
    </svg>
  );

  const GolfIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2v14" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M12 2l4 4-4 2V2z" fill="currentColor"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
      <path d="M8 22h8" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );

  const BasketballIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="12" cy="12" r="9" fill="currentColor"/>
      <path d="M3 12h18M12 3v18M7 7l10 10M17 7L7 17" stroke="white" strokeWidth="0.8" fill="none"/>
    </svg>
  );

  // Function to get sport icon component based on sport name
  const getSportIcon = (sport: string) => {
    const sportLower = sport?.toLowerCase() || '';
    
    if (sportLower.includes('football')) return FootballIcon; // Soccer ball with pentagon pattern
    if (sportLower.includes('rugby')) return RugbyIcon; // Oval rugby ball
    if (sportLower.includes('soccer')) return FootballIcon; // Soccer ball
    if (sportLower.includes('basketball')) return BasketballIcon; // Basketball with lines
    if (sportLower.includes('volleyball')) return Circle; // Volleyball
    if (sportLower.includes('tennis')) return TennisIcon; // Tennis ball with curved lines
    if (sportLower.includes('badminton')) return Swords; // Badminton racquet
    if (sportLower.includes('baseball') || sportLower.includes('cricket')) return Circle; // Ball sports
    if (sportLower.includes('golf')) return GolfIcon; // Golf flag and hole
    if (sportLower.includes('swimming')) return Waves; // Keep as is
    if (sportLower.includes('running') || sportLower.includes('marathon')) return Zap; // Keep as is
    if (sportLower.includes('cycling') || sportLower.includes('biking')) return Bike; // Keep as is
    if (sportLower.includes('boxing') || sportLower.includes('wrestling') || sportLower.includes('martial')) return Dumbbell;
    if (sportLower.includes('skiing') || sportLower.includes('snowboard')) return Mountain;
    if (sportLower.includes('climbing') || sportLower.includes('rock')) return Mountain;
    if (sportLower.includes('yoga') || sportLower.includes('meditation')) return Heart;
    if (sportLower.includes('dance') || sportLower.includes('social')) return Music;
    
    // Default fallback icon
    return Users;
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
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: event.primaryTeam?.color || '#3b82f6' }}
                      >
                        {(() => {
                          const IconComponent = getSportIcon(event.primaryTeam?.sports?.[0] || '');
                          return <IconComponent className="w-6 h-6 text-white" />;
                        })()}
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
                        {team.teamImagePath ? (
                          <img 
                            src={team.teamImagePath} 
                            alt={`${team.name} team`}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: team.color || '#3b82f6' }}
                          >
                            {(() => {
                              const IconComponent = getSportIcon(team.sports?.[0] || '');
                              return <IconComponent className="w-6 h-6 text-white" />;
                            })()}
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium text-neutral-900">{team.name}</h4>
                          <p className="text-sm text-neutral-500">{team.sports?.join(', ') || 'No sports listed'}</p>
                          <p className="text-sm text-neutral-500">{team.memberCount} members</p>
                        </div>
                        <Badge variant="outline" className={
                          team.isOwner ? "text-blue-600 font-semibold" :
                          team.role === "admin" ? "text-secondary" :
                          team.role === "captain" ? "text-primary" :
                          team.role === "coach" ? "text-purple-600" : "text-neutral-600"
                        }>
                          {team.isOwner ? "owner" : team.role}
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
