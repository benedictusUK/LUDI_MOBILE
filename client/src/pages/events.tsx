import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import Navigation from "@/components/ui/nav";
import EventForm from "@/components/ui/event-form";
import AuditModal from "@/components/ui/audit-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Events() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [auditModal, setAuditModal] = useState<{ isOpen: boolean; eventId: string; eventName: string }>({
    isOpen: false,
    eventId: "",
    eventName: "",
  });

  // Extract team parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const teamParam = urlParams.get('team');
    if (teamParam) {
      setSelectedTeamId(teamParam);
    }
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

  // Filter events by selected team if specified
  const filteredEvents = selectedTeamId 
    ? (events as any[]).filter((event: any) => event.primaryTeamId === selectedTeamId)
    : events;

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
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
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                {selectedTeam ? `${selectedTeam.name} Events` : "Event Management"}
              </h1>
              <p className="text-neutral-500">
                {selectedTeam 
                  ? `Manage events for ${selectedTeam.name}` 
                  : "Create and manage your sports events"
                }
              </p>
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
        </div>

        {(showCreateForm || editingEvent) && (
          <div className="mb-8">
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
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No events yet</h3>
              <p className="text-neutral-500 mb-4">Create your first sports event to get started</p>
              <Button onClick={() => {
                setShowCreateForm(true);
                setEditingEvent(null);
              }}>
                Create Event
              </Button>
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
                    <div className="absolute top-4 right-4">
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
                        <i className="fas fa-football-ball text-white text-lg"></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900">
                          {event.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-neutral-500">{event.sport}</p>
                          {event.primaryTeam && (
                            <span 
                              className="text-xs px-2 py-1 rounded-full text-white font-medium"
                              style={{ backgroundColor: teamColor }}
                            >
                              {event.primaryTeam.name}
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
                        onClick={() => {
                          window.location.href = `/events/${event.id}`;
                        }}
                      >
                        Vote
                      </Button>
                    )}
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
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => deleteEventMutation.mutate(event.id)}
                      disabled={deleteEventMutation.isPending}
                      className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                    >
                      Delete
                    </Button>
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
    </div>
  );
}
