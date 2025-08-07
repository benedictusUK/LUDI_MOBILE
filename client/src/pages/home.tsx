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
    <svg viewBox="0 0 48 48" className={className} fill="currentColor">
      <path d="M24,2A22,22,0,1,0,46,24,21.9,21.9,0,0,0,24,2ZM18.6,6.9,20,6.4A18.1,18.1,0,0,1,24,6a19.1,19.1,0,0,1,5.4.8l1.1,3.3L24,14.7l-6.5-4.6ZM6,23.8A17.6,17.6,0,0,1,9.4,13.6h3.4l2.3,7.6L8.8,25.9ZM18.3,41.1a18.2,18.2,0,0,1-8.8-6.4l1.1-3.3h7.9l2.6,7.6ZM20,29l-2.5-7.4L24,17l6.5,4.6L28,29Zm9.7,12.1-2.8-2,2.6-7.6h7.9l1.1,3.3A18.4,18.4,0,0,1,29.7,41.1Zm9.5-15.2-6.3-4.8,2.3-7.6h3.5A18.7,18.7,0,0,1,41.6,20a25.8,25.8,0,0,1,.4,3.8Z"/>
    </svg>
  );

  const RugbyIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 42.148 42.148" className={className} fill="currentColor">
      <path d="M41.203,14.814c-1.11-2.175-2.512-4.261-4.178-6.195c-0.535-0.621-1.096-1.227-1.684-1.814
c-0.592-0.59-1.199-1.146-1.822-1.682c-1.938-1.669-4.021-3.076-6.188-4.185C31.382,0.125,34.784,0,36.468,0
c0.568,0,0.885,0.015,0.885,0.015c2.586,0.121,4.672,2.197,4.781,4.784C42.148,5.146,42.296,9.379,41.203,14.814z M6.808,35.342
c-0.588-0.59-1.148-1.194-1.685-1.815c-1.666-1.933-3.065-4.021-4.178-6.195C-0.148,32.768,0,37.002,0.014,37.35
c0.109,2.586,2.197,4.662,4.783,4.783c0,0,0.312,0.016,0.881,0.016c1.683,0,5.088-0.126,9.138-0.938
c-2.168-1.109-4.25-2.517-6.188-4.186C8.008,36.487,7.398,35.93,6.808,35.342z M35.914,15.596c1.386,2.309,2.355,4.752,2.857,7.223
c-1.43,3.377-3.455,6.744-6.33,9.619c-2.879,2.879-6.242,4.905-9.619,6.337c-2.438-0.503-4.895-1.482-7.213-2.867
c-1.869-1.116-3.648-2.486-5.254-4.092c-0.004-0.004-0.008-0.01-0.012-0.014c-0.004-0.002-0.009-0.006-0.011-0.011
c-1.614-1.616-2.981-3.388-4.098-5.245c-1.386-2.309-2.354-4.75-2.856-7.222c1.43-3.377,3.454-6.745,6.329-9.62
c2.88-2.879,6.242-4.906,9.617-6.336c2.438,0.503,4.896,1.482,7.215,2.867c1.869,1.116,3.647,2.488,5.255,4.092
c0.005,0.004,0.009,0.007,0.013,0.011c0,0,0.002,0,0.002,0.001C33.429,11.961,34.798,13.736,35.914,15.596z M26.218,11.14
c-1.172-1.172-3.07-1.172-4.243,0c-0.668,0.668-0.94,1.572-0.848,2.444c0.07,0.656,0.346,1.295,0.848,1.798l4.792,4.791
c0.502,0.501,1.14,0.775,1.791,0.847c0.111,0.012,0.222,0.032,0.33,0.032c0.769,0,1.535-0.293,2.121-0.879
c1.172-1.171,1.172-3.071,0-4.242L26.218,11.14z M24.307,26.333c0.469-0.137,0.914-0.375,1.283-0.743
c0.367-0.371,0.607-0.815,0.744-1.285c0.297-1.018,0.057-2.156-0.744-2.958l-4.788-4.788c-0.804-0.803-1.943-1.042-2.961-0.745
c-0.47,0.136-0.912,0.375-1.281,0.744c-0.369,0.369-0.609,0.814-0.746,1.282c-0.297,1.018-0.057,2.158,0.746,2.96l4.787,4.789
c0.584,0.586,1.354,0.879,2.122,0.879C23.753,26.469,24.033,26.413,24.307,26.333z M15.933,31.008
c0.586,0.586,1.354,0.879,2.121,0.879s1.535-0.293,2.121-0.879c0.668-0.668,0.94-1.574,0.848-2.445
c-0.072-0.656-0.346-1.295-0.848-1.797l-4.79-4.792c-0.504-0.503-1.144-0.777-1.8-0.849c-0.87-0.094-1.774,0.18-2.442,0.849
c-1.172,1.171-1.172,3.07,0,4.242L15.933,31.008z"/>
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
    
    // Check rugby first with multiple variations
    if (sportLower.includes('rugby') || sportLower === 'rugby') return RugbyIcon; // Oval rugby ball
    if (sportLower.includes('football') && !sportLower.includes('american')) return FootballIcon; // Soccer ball with pentagon pattern
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
                          const IconComponent = getSportIcon(event.sport || '');
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
