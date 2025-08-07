import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useScrollToTop, useScrollToElement } from "@/hooks/useScrollToTop";
import Navigation from "@/components/ui/nav";
import EventForm from "@/components/ui/event-form";
import AuditModal from "@/components/ui/audit-modal";
import RecurringEventsManager from "@/components/ui/recurring-events-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LudiInlineLoader } from "@/components/ui/ludi-loader";
import { 
  Users, Trophy, Target, Dumbbell, Zap, Mountain, 
  Bike, Waves, Heart, Music, Flag, Swords, Circle
} from "lucide-react";

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
c-2.168-1.109-4.25-2.517-6.188-4.186C8.008,36.487,7.398,35.930,6.808,35.342z M35.914,15.596c1.386,2.309,2.355,4.752,2.857,7.223
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

export default function Events() {
  useScrollToTop();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  useScrollToElement((editingEvent || showCreateForm) ? `edit-form` : undefined);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [votingStatusFilter, setVotingStatusFilter] = useState<string>("all");
  const [showPastEvents, setShowPastEvents] = useState<boolean>(false);
  const [auditModal, setAuditModal] = useState<{ isOpen: boolean; eventId: string; eventName: string }>({
    isOpen: false,
    eventId: "",
    eventName: "",
  });
  const [recurringManager, setRecurringManager] = useState<{
    isOpen: boolean;
    eventId: string;
    recurringSeriesId: string;
  }>({
    isOpen: false,
    eventId: "",
    recurringSeriesId: "",
  });

  // Extract team parameter from URL
  useEffect(() => {
    // Get the full URL to handle query parameters properly
    const fullUrl = window.location.href;
    const url = new URL(fullUrl);
    const teamParam = url.searchParams.get('team');
    setSelectedTeamId(teamParam || null);
  }, [location]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/events"],
  });

  // Pre-fetch event details, attendance, and potential players for all events
  // This will cache the data so event details page loads instantly
  useEffect(() => {
    if (events && Array.isArray(events)) {
      events.forEach((event: any) => {
        // Pre-fetch event details (already have basic info, but ensure it's cached)
        queryClient.prefetchQuery({
          queryKey: ["/api/events", event.id],
          staleTime: 60000, // Cache for 1 minute
        });
        
        // Pre-fetch attendance data
        queryClient.prefetchQuery({
          queryKey: ["/api/events", event.id, "attendance"],
          staleTime: 30000, // Cache for 30 seconds
        });
        
        // Pre-fetch potential players
        queryClient.prefetchQuery({
          queryKey: ["/api/events", event.id, "potential-players"],
          staleTime: 30000, // Cache for 30 seconds
        });
      });
    }
  }, [events]);

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  // Fetch attendance data for all events to determine voting status
  const attendanceQueries = useQuery({
    queryKey: ["/api/events/attendance-all"],
    queryFn: async () => {
      if (!events || events.length === 0) return {};
      
      const attendanceData: { [eventId: string]: any[] } = {};
      await Promise.all(
        (events as any[]).map(async (event) => {
          try {
            const response = await fetch(`/api/events/${event.id}/attendance`, {
              credentials: "include",
            });
            if (response.ok) {
              attendanceData[event.id] = await response.json();
            }
          } catch (error) {
            console.error(`Failed to fetch attendance for event ${event.id}:`, error);
          }
        })
      );
      return attendanceData;
    },
    enabled: events && (events as any[]).length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });

  const { user } = useAuth();

  // Helper function to check if user can edit an event
  const canEditEvent = (event: any) => {
    if (!user || !event?.primaryTeamId) return false;
    
    const primaryTeam = (teams as any[]).find((team: any) => team.id === event.primaryTeamId);
    if (!primaryTeam) return false;
    
    // User can edit if they're the team owner
    if (primaryTeam.ownerId === (user as any).id) return true;
    
    // User can edit if they have admin or captain role in the team
    // The team object already contains the user's role since getUserTeams returns the user's role
    return primaryTeam.role === "admin" || primaryTeam.role === "captain";
  };

  // Helper function to get user's voting status for an event
  const getUserVotingStatus = (eventId: string): 'attending' | 'not_attending' | 'not_voted' => {
    const attendanceData = attendanceQueries.data?.[eventId] || [];
    const userAttendance = attendanceData.find((a: any) => a.userId === (user as any)?.id);
    
    if (!userAttendance) return 'not_voted';
    return userAttendance.status === 'attending' ? 'attending' : 'not_attending';
  };

  // Helper function to check if event is in the past
  const isEventPast = (event: any): boolean => {
    const eventDate = new Date(event.dateTime);
    const now = new Date();
    return eventDate < now;
  };

  // Apply all filters
  const filteredEvents = (events as any[])
    .filter((event: any) => {
      // Team filter
      if (selectedTeamId && event.primaryTeamId !== selectedTeamId) return false;
      
      // Past events filter
      if (!showPastEvents && isEventPast(event)) return false;
      
      // Voting status filter
      if (votingStatusFilter !== 'all') {
        const votingStatus = getUserVotingStatus(event.id);
        if (votingStatusFilter !== votingStatus) return false;
      }
      
      return true;
    });

  // Calculate filter counts
  const allEventsCount = events.length;
  const futureEventsCount = (events as any[]).filter(event => !isEventPast(event)).length;
  const pastEventsCount = allEventsCount - futureEventsCount;
  
  const attendingCount = (events as any[]).filter(event => 
    (!showPastEvents ? !isEventPast(event) : true) &&
    (!selectedTeamId || event.primaryTeamId === selectedTeamId) &&
    getUserVotingStatus(event.id) === 'attending'
  ).length;
  
  const notAttendingCount = (events as any[]).filter(event => 
    (!showPastEvents ? !isEventPast(event) : true) &&
    (!selectedTeamId || event.primaryTeamId === selectedTeamId) &&
    getUserVotingStatus(event.id) === 'not_attending'
  ).length;
  
  const notVotedCount = (events as any[]).filter(event => 
    (!showPastEvents ? !isEventPast(event) : true) &&
    (!selectedTeamId || event.primaryTeamId === selectedTeamId) &&
    getUserVotingStatus(event.id) === 'not_voted'
  ).length;

  const selectedTeam = selectedTeamId 
    ? (teams as any[]).find((team: any) => team.id === selectedTeamId)
    : null;

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LudiInlineLoader size="md" message="Loading events..." />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">
                {selectedTeam ? `${selectedTeam.name} Events` : "Events"}
              </h1>
              {selectedTeam && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => {
                    setSelectedTeamId(null);
                    window.history.pushState({}, '', '/events');
                  }}
                >
                  <i className="fas fa-arrow-left mr-2"></i>
                  Back to All Events
                </Button>
              )}
            </div>
            <Button 
              onClick={() => {
                setShowCreateForm(true);
                setEditingEvent(null);
              }}
              className="flex items-center space-x-2"
            >
              <i className="fas fa-plus"></i>
              <span>Create Event</span>
            </Button>
          </div>

          {/* Filters */}
          <div className="mt-6 space-y-4">
            {/* First row - Team and Voting Status filters */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-neutral-600">Filter by Team:</label>
                <Select 
                  value={selectedTeamId || "all"} 
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSelectedTeamId(null);
                      window.history.pushState({}, '', '/events');
                    } else {
                      setSelectedTeamId(value);
                      window.history.pushState({}, '', `/events?team=${value}`);
                    }
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {(teams as any[]).map((team: any) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: team.color || '#3b82f6' }}
                          />
                          <span>{team.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-neutral-600">Voting Status:</label>
                <Select 
                  value={votingStatusFilter} 
                  onValueChange={setVotingStatusFilter}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ({showPastEvents ? allEventsCount : futureEventsCount})</SelectItem>
                    <SelectItem value="attending">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Attending ({attendingCount})</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="not_attending">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span>Can't Attend ({notAttendingCount})</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="not_voted">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-neutral-400"></div>
                        <span>Not Voted ({notVotedCount})</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second row - Past events toggle and event count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="show-past-events"
                    checked={showPastEvents}
                    onCheckedChange={setShowPastEvents}
                  />
                  <Label 
                    htmlFor="show-past-events" 
                    className="text-sm font-medium text-neutral-600 cursor-pointer"
                  >
                    Show Past Events ({pastEventsCount})
                  </Label>
                </div>
              </div>

              {filteredEvents.length !== events.length && (
                <Badge variant="secondary" className="text-xs">
                  Showing {filteredEvents.length} of {showPastEvents ? allEventsCount : futureEventsCount} events
                </Badge>
              )}
            </div>
          </div>
        </div>

        {(showCreateForm || editingEvent) && (
          <div id="edit-form" className="mb-8">
            <EventForm 
              eventId={editingEvent || undefined}
              onCancel={() => {
                setShowCreateForm(false);
                setEditingEvent(null);
              }}
              onSuccess={() => {
                setShowCreateForm(false);
                setEditingEvent(null);
              }}
            />
          </div>
        )}

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(filteredEvents as any[]).length === 0 ? (
            <div className="col-span-full text-center py-12">
              <i className="fas fa-calendar text-neutral-300 text-6xl mb-4"></i>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                {events.length === 0 
                  ? "No events yet" 
                  : "No events match your filters"
                }
              </h3>
              <p className="text-neutral-500 mb-4">
                {events.length === 0 
                  ? "Create your first sports event to get started"
                  : "Try adjusting your filters to see more events"
                }
              </p>
              {events.length === 0 && (
                <Button onClick={() => {
                  setShowCreateForm(true);
                  setEditingEvent(null);
                }}>
                  Create Event
                </Button>
              )}
            </div>
          ) : (
            (filteredEvents as any[]).map((event: any) => {
              // Use primary team color or fallback to default
              const teamColor = event.primaryTeam?.color || "#3b82f6";
              
              // Handle hover prefetching for instant loading
              const handleHover = () => {
                // Pre-fetch activity logs on hover for instant loading
                queryClient.prefetchQuery({
                  queryKey: ["/api/events", event.id, "activity"],
                  staleTime: 30000,
                });
              };

              return (
                <Card 
                  id={`event-${event.id}`}
                  key={event.id} 
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onMouseEnter={handleHover}
                >
                  <div 
                    className="h-32 relative flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}dd 100%)` 
                    }}
                  >
                    {(() => {
                      const IconComponent = getSportIcon(event.sport || '');
                      return <IconComponent className="text-white w-16 h-16 opacity-50" />;
                    })()}
                    
                    <div className="absolute top-4 right-4 flex gap-2">
                      {event.recurringSeriesId && (
                        <Badge 
                          variant="secondary" 
                          className="bg-white/20 text-white border-white/30"
                        >
                          Recurring
                        </Badge>
                      )}
                      <Badge 
                        variant={event.isPublished ? "default" : "secondary"}
                        className={event.isPublished ? "" : "bg-white/20 text-white border-white/30"}
                      >
                        {event.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: teamColor }}
                      >
                        {(() => {
                          const IconComponent = getSportIcon(event.sport || '');
                          return <IconComponent className="w-6 h-6 text-white" />;
                        })()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900">
                          {event.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-neutral-500">{event.sport}</p>
                          {event.primaryTeam && (
                            <span 
                              className="text-xs px-2 py-1 rounded-full text-white font-medium max-w-32 truncate"
                              style={{ backgroundColor: teamColor }}
                              title={event.primaryTeam.name}
                            >
                              {event.primaryTeam.name.length > 15 ? `${event.primaryTeam.name.substring(0, 15)}...` : event.primaryTeam.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Date:</span>
                      <span className="font-medium text-neutral-900">
                        {new Date(event.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Time:</span>
                      <span className="font-medium text-neutral-900">{event.startTime}</span>
                    </div>
                    {event.location && (
                      <div className="flex items-start justify-between text-sm">
                        <span className="text-neutral-500 flex-shrink-0">Location:</span>
                        <span className="font-medium text-neutral-900 text-right ml-2 break-words">
                          {event.location.length > 30 ? `${event.location.substring(0, 30)}...` : event.location}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Cost:</span>
                      <span className="font-medium text-neutral-900">
                        {(!event.cost || parseFloat(event.cost) === 0) ? "Unknown" : `£${parseFloat(event.cost).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {event.isPublished && (
                      <Button 
                        size="sm" 
                        style={{ 
                          backgroundColor: teamColor,
                          borderColor: teamColor
                        }}
                        onClick={async () => {
                          // Pre-load event data before navigation
                          await Promise.all([
                            queryClient.prefetchQuery({
                              queryKey: ["/api/events", event.id],
                            }),
                            queryClient.prefetchQuery({
                              queryKey: ["/api/events", event.id, "attendance"],
                            }),
                            queryClient.prefetchQuery({
                              queryKey: ["/api/events", event.id, "activity"],
                            }),
                          ]);
                          setLocation(`/events/${event.id}`);
                        }}
                      >
                        Vote
                      </Button>
                    )}
                    {canEditEvent(event) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        style={{ 
                          borderColor: teamColor,
                          color: teamColor
                        }}
                        onClick={() => {
                          setEditingEvent(event.id);
                          setShowCreateForm(false);
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    {event.enableVoting && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        style={{ 
                          borderColor: teamColor,
                          color: teamColor
                        }}
                        className="hover:bg-opacity-10"
                        onClick={() => setAuditModal({
                          isOpen: true,
                          eventId: event.id,
                          eventName: event.name,
                        })}
                      >
                        Audit
                      </Button>
                    )}
                    {event.recurringSeriesId && canEditEvent(event) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        style={{ 
                          borderColor: teamColor,
                          color: teamColor
                        }}
                        onClick={() => setRecurringManager({
                          isOpen: true,
                          eventId: event.id,
                          recurringSeriesId: event.recurringSeriesId,
                        })}
                      >
                        Manage Series
                      </Button>
                    )}
                    {canEditEvent(event) && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => deleteEventMutation.mutate(event.id)}
                        disabled={deleteEventMutation.isPending}
                        className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
            })
          )}
        </div>
      </main>

      {/* Audit Modal */}
      <AuditModal
        eventId={auditModal.eventId}
        eventName={auditModal.eventName}
        isOpen={auditModal.isOpen}
        onClose={() => setAuditModal({ isOpen: false, eventId: "", eventName: "" })}
      />

      {/* Recurring Events Manager Modal */}
      {recurringManager.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <RecurringEventsManager
            eventId={recurringManager.eventId}
            recurringSeriesId={recurringManager.recurringSeriesId}
            onClose={() => setRecurringManager({ isOpen: false, eventId: "", recurringSeriesId: "" })}
          />
        </div>
      )}
    </div>
  );
}
