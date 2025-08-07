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
                    className="h-32 relative"
                    style={{ 
                      background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}dd 100%)` 
                    }}
                  >
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
                          const IconComponent = getSportIcon(event.primaryTeam?.sports?.[0] || '');
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
