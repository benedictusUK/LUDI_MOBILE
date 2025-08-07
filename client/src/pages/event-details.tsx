import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import LudiLoader from "@/components/ui/ludi-loader";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Vote, X, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { FlareGunModal } from "@/components/ui/flare-gun-modal";
import { ReservePlayersManager } from "@/components/ui/reserve-players-manager";

export default function EventDetails() {
  const [, params] = useRoute("/events/:id");
  const eventId = params?.id;
  const { user } = useAuth();
  const [voteDetailsModal, setVoteDetailsModal] = useState<{
    isOpen: boolean;
    type: "attending" | "not_attending" | "no_response";
    voters: any[];
  }>({
    isOpen: false,
    type: "attending",
    voters: [],
  });

  // Fetch event details first (priority data)
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  // Fetch event attendance (priority data)
  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ["/api/events", eventId, "attendance"],
    enabled: !!eventId,
  });

  // Fetch potential players (secondary data - only after event loads)
  const { data: potentialPlayers } = useQuery({
    queryKey: ["/api/events", eventId, "potential-players"],
    enabled: !!eventId && !!event,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch activity logs (secondary data - only after event loads)
  const { data: activityLogs } = useQuery({
    queryKey: ["/api/events", eventId, "activity"],
    enabled: !!eventId && !!event,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch event capacity info
  const { data: capacity } = useQuery({
    queryKey: ["/api/events", eventId, "capacity"],
    enabled: !!eventId && !!event,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Vote mutation with optimistic updates
  const voteMutation = useMutation({
    mutationFn: async (status: "attending" | "not_attending") => {
      const response = await fetch(`/api/events/${eventId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to vote");
      return response.json();
    },
    onMutate: async (status) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/events", eventId, "attendance"] });
      
      // Snapshot the previous value
      const previousAttendance = queryClient.getQueryData(["/api/events", eventId, "attendance"]);
      
      // Optimistically update to the new value
      const userId = (user as any)?.id;
      if (userId && previousAttendance) {
        const currentAttendance = previousAttendance as any[];
        const existingVote = currentAttendance.find(a => a.userId === userId);
        
        let updatedAttendance;
        if (existingVote) {
          // Update existing vote
          updatedAttendance = currentAttendance.map(a => 
            a.userId === userId ? { ...a, status, votedAt: new Date().toISOString() } : a
          );
        } else {
          // Add new vote
          updatedAttendance = [...currentAttendance, {
            id: `temp-${Date.now()}`,
            eventId,
            userId,
            status,
            votedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            user: user
          }];
        }
        
        queryClient.setQueryData(["/api/events", eventId, "attendance"], updatedAttendance);
      }
      
      // Return a context object with the snapshotted value
      return { previousAttendance };
    },
    onError: (err, status, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousAttendance) {
        queryClient.setQueryData(["/api/events", eventId, "attendance"], context.previousAttendance);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "potential-players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "capacity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "reserves"] });
    },
  });

  // Unvote mutation with optimistic updates
  const unvoteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/events/${eventId}/vote`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to unvote");
      return response.json();
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/events", eventId, "attendance"] });
      
      // Snapshot the previous value
      const previousAttendance = queryClient.getQueryData(["/api/events", eventId, "attendance"]);
      
      // Optimistically remove the user's vote
      const userId = (user as any)?.id;
      if (userId && previousAttendance) {
        const currentAttendance = previousAttendance as any[];
        const updatedAttendance = currentAttendance.filter(a => a.userId !== userId);
        queryClient.setQueryData(["/api/events", eventId, "attendance"], updatedAttendance);
      }
      
      return { previousAttendance };
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousAttendance) {
        queryClient.setQueryData(["/api/events", eventId, "attendance"], context.previousAttendance);
      }
    },
    onSettled: () => {
      // Always refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "potential-players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "capacity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "reserves"] });
    },
  });

  if (eventLoading || attendanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <LudiLoader size="lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Event not found</h2>
          <p className="text-neutral-600 mb-4">The event you're looking for doesn't exist.</p>
          <Link href="/events">
            <Button>Back to Events</Button>
          </Link>
        </div>
      </div>
    );
  }

  const eventData = event as any;
  const teamColor = eventData?.primaryTeam?.color || "#3b82f6";
  const userAttendance = (attendance as any[])?.find((a: any) => a.userId === (user as any)?.id);
  
  // Calculate vote statistics
  const attendingVoters = (attendance as any[])?.filter((a: any) => a.status === "attending") || [];
  const notAttendingVoters = (attendance as any[])?.filter((a: any) => a.status === "not_attending") || [];
  const potentialPlayersList = (potentialPlayers as any[]) || [];
  
  const attendingCount = attendingVoters.length;
  const notAttendingCount = notAttendingVoters.length;
  const potentialCount = potentialPlayersList.length;
  const totalPlayers = attendingCount + notAttendingCount + potentialCount;
  
  const attendingPercentage = totalPlayers > 0 ? (attendingCount / totalPlayers) * 100 : 0;
  const notAttendingPercentage = totalPlayers > 0 ? (notAttendingCount / totalPlayers) * 100 : 0;
  const potentialPercentage = totalPlayers > 0 ? (potentialCount / totalPlayers) * 100 : 0;

  // Show vote details modal
  const showVoteDetails = (type: "attending" | "not_attending" | "no_response", voters: any[]) => {
    setVoteDetailsModal({
      isOpen: true,
      type,
      voters,
    });
  };

  // Get unvote activity for the modal
  const getUnvoteActivity = (userId: string) => {
    if (!activityLogs) return [];
    return (activityLogs as any[]).filter(log => 
      log.userId === userId && log.action === "unvoted"
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div 
        className="relative h-64"
        style={{ 
          background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}dd 100%)` 
        }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 p-6">
          <Link href="/events">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Events
            </Button>
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{eventData.name}</h1>
              <div className="flex items-center space-x-4 text-white/90">
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {new Date(eventData.startDate).toLocaleDateString()}
                </span>
                <span className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {eventData.startTime}
                </span>
                {eventData.location && (
                  <span className="flex items-center max-w-60 truncate" title={eventData.location}>
                    <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate">{eventData.location}</span>
                  </span>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <Badge 
                variant={eventData.isPublished ? "default" : "secondary"}
                className="bg-white/20 text-white border-white/30 mb-2"
              >
                {eventData.isPublished ? "Published" : "Draft"}
              </Badge>
              {eventData.primaryTeam && (
                <div className="text-white/90 text-sm max-w-48 truncate" title={`Primary Team: ${eventData.primaryTeam.name}`}>
                  Primary Team: {eventData.primaryTeam.name}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 -mt-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Event Details */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Sport</label>
                    <p className="text-neutral-900">{(event as any).sport}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Cost</label>
                    <p className="text-neutral-900">
                      {(!(event as any).cost || parseFloat((event as any).cost) === 0) ? "Free" : `£${parseFloat((event as any).cost).toFixed(2)}`}
                    </p>
                  </div>
                  {(event as any).endDate && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">End Date</label>
                      <p className="text-neutral-900">{new Date((event as any).endDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  {(event as any).endTime && (
                    <div>
                      <label className="text-sm font-medium text-neutral-600">End Time</label>
                      <p className="text-neutral-900">{(event as any).endTime}</p>
                    </div>
                  )}
                </div>
                
                {(event as any).requirements && (
                  <div>
                    <label className="text-sm font-medium text-neutral-600">Description</label>
                    <p className="text-neutral-900 whitespace-pre-wrap">{(event as any).requirements}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Voting Section */}
            {(event as any).isPublished && (
              <Card className="mt-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <Vote className="w-5 h-5 mr-2" />
                      Attendance
                    </CardTitle>
                    <FlareGunModal 
                      event={eventData} 
                      isAuthorized={
                        user && eventData.primaryTeam && (
                          eventData.primaryTeam.ownerId === (user as any).id || 
                          eventData.primaryTeam.memberships?.some((m: any) => 
                            m.userId === (user as any).id && m.role === 'admin'
                          )
                        )
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Voting Buttons */}
                  <div className="flex space-x-3">
                    {userAttendance ? (
                      <>
                        <Button
                          onClick={() => unvoteMutation.mutate()}
                          disabled={unvoteMutation.isPending}
                          variant="outline"
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Unvote
                        </Button>
                        <div className="flex-1 text-sm text-neutral-600 p-2">
                          Your vote: <span className="font-medium capitalize">
                            {userAttendance.status === "reserve" ? "Reserve List" : userAttendance.status.replace('_', ' ')}
                          </span>
                          {userAttendance.status === "reserve" && (
                            <div className="text-xs text-amber-600 font-medium mt-1">
                              You're on the reserve list - you'll be promoted when a spot opens up
                            </div>
                          )}
                          <br />
                          Voted: {new Date(userAttendance.votedAt).toLocaleString()}
                        </div>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => voteMutation.mutate("attending")}
                          disabled={voteMutation.isPending}
                          style={{ backgroundColor: teamColor, borderColor: teamColor }}
                          className="flex-1 whitespace-normal"
                        >
                          <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="text-center">
                            {capacity && (capacity as any)?.maxParticipants && (capacity as any)?.availableSpots <= 0 ? "Become a reserve" : "I can attend"}
                          </span>
                        </Button>
                        <Button
                          onClick={() => voteMutation.mutate("not_attending")}
                          disabled={voteMutation.isPending}
                          variant="outline"
                          className="flex-1 hover:bg-red-50 hover:border-red-300 hover:text-red-600 whitespace-normal"
                        >
                          <X className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="text-center">I can't attend</span>
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Voting Progress Bars */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">Can Attend</span>
                        </div>
                        <span className="text-sm font-bold">{attendingCount}</span>
                      </div>
                      <div 
                        className="cursor-pointer"
                        onClick={() => showVoteDetails("attending", attendingVoters)}
                      >
                        <Progress
                          value={attendingPercentage}
                          className="h-3 hover:opacity-80 [&>div]:bg-green-500"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {attendingPercentage.toFixed(1)}% of team members
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium">Can't Attend</span>
                        </div>
                        <span className="text-sm font-bold">{notAttendingCount}</span>
                      </div>
                      <div 
                        className="cursor-pointer"
                        onClick={() => showVoteDetails("not_attending", notAttendingVoters)}
                      >
                        <Progress
                          value={notAttendingPercentage}
                          className="h-3 hover:opacity-80 [&>div]:bg-red-500"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {notAttendingPercentage.toFixed(1)}% of team members
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MinusCircle className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-medium">Potential Players</span>
                        </div>
                        <span className="text-sm font-bold">{potentialCount}</span>
                      </div>
                      <div 
                        className="cursor-pointer"
                        onClick={() => showVoteDetails("no_response", potentialPlayersList.map(player => ({ user: player })))}
                      >
                        <Progress
                          value={potentialPercentage}
                          className="h-3 hover:opacity-80 [&>div]:bg-gray-400"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {potentialPercentage.toFixed(1)}% of team members
                      </div>
                    </div>

                    {(attendingCount + notAttendingCount) === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <MinusCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>No votes yet. Be the first to respond!</p>
                      </div>
                    )}
                  </div>

                  <div className="text-center text-sm text-muted-foreground border-t pt-4">
                    Total Responses: {attendingCount + notAttendingCount} of {totalPlayers} team members
                    <br />
                    <span className="text-xs">Click on progress bars to see details</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Reserve Players Manager */}
          {(event as any).isPublished && eventId && (event as any).reserveSpots > 0 && (
            <div>
              <ReservePlayersManager 
                eventId={eventId}
                isAdmin={
                  user && eventData?.primaryTeam && (
                    eventData.primaryTeam.ownerId === (user as any).id || 
                    eventData.primaryTeam.memberships?.some((m: any) => 
                      m.userId === (user as any).id && m.role === 'admin'
                    )
                  )
                }
              />
            </div>
          )}

          {/* Attendance List */}
          {(event as any).isPublished && attendance && (attendance as any[]).length > 0 && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Attendance List</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(attendance as any[]).map((vote: any) => (
                      <div key={vote.userId} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {vote.user?.firstName?.[0] || vote.user?.email?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {vote.user?.firstName} {vote.user?.lastName} 
                            </div>
                            <div className="text-xs text-neutral-500">
                              {vote.user?.email}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={vote.status === "attending" ? "default" : "destructive"}
                            className={vote.status === "attending" ? "" : "bg-red-100 text-red-800 border-red-200"}
                          >
                            {vote.status === "attending" ? "Attending" : "Not Attending"}
                          </Badge>
                          <div className="text-xs text-neutral-500 mt-1">
                            {new Date(vote.votedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Vote Details Modal */}
      <Dialog 
        open={voteDetailsModal.isOpen} 
        onOpenChange={(open) => setVoteDetailsModal({ ...voteDetailsModal, isOpen: open })}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {voteDetailsModal.type === "attending" ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : voteDetailsModal.type === "not_attending" ? (
                <XCircle className="h-5 w-5 text-red-600" />
              ) : (
                <MinusCircle className="h-5 w-5 text-gray-600" />
              )}
              {voteDetailsModal.type === "attending" ? "Can Attend" : 
               voteDetailsModal.type === "not_attending" ? "Can't Attend" : "Potential Players"} 
              ({voteDetailsModal.voters.length})
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {voteDetailsModal.voters.map((voter: any) => {
                const unvoteHistory = voteDetailsModal.type !== "no_response" ? getUnvoteActivity(voter.userId) : [];
                return (
                  <div key={voter.userId || voter.user?.id} className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {voter.user?.firstName?.[0] || voter.user?.email?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">
                            {voter.user?.firstName} {voter.user?.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {voter.user?.email}
                          </div>
                        </div>
                      </div>
                      {voteDetailsModal.type !== "no_response" && (
                        <div className="text-right">
                          <div className="text-xs font-medium text-green-600">
                            Voted: {new Date(voter.votedAt).toLocaleString()}
                          </div>
                        </div>
                      )}
                      {voteDetailsModal.type === "no_response" && (
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-600">
                            Team Member
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {unvoteHistory.length > 0 && (
                      <div className="border-t border-muted-foreground/20 pt-2">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Unvote History:</div>
                        {unvoteHistory.slice(0, 3).map((unvote: any, index: number) => (
                          <div key={index} className="text-xs text-red-600 opacity-80">
                            Unvoted: {new Date(unvote.timestamp).toLocaleString()}
                          </div>
                        ))}
                        {unvoteHistory.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{unvoteHistory.length - 3} more unvotes
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}