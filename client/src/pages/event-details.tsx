import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { queryClient } from "@/lib/queryClient";
import { ArrowLeft, Calendar, Clock, MapPin, Users, Vote, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function EventDetails() {
  const [, params] = useRoute("/events/:id");
  const eventId = params?.id;
  const { user } = useAuth();

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  // Fetch event attendance
  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ["/api/events", eventId, "attendance"],
    enabled: !!eventId,
  });

  // Vote mutation
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
    },
  });

  // Unvote mutation
  const unvoteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/events/${eventId}/vote`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to unvote");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
    },
  });

  if (eventLoading || attendanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading event details...</p>
        </div>
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
  const attendingCount = (attendance as any[])?.filter((a: any) => a.status === "attending").length || 0;
  const notAttendingCount = (attendance as any[])?.filter((a: any) => a.status === "not_attending").length || 0;

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
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {eventData.location}
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
                <div className="text-white/90 text-sm">
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
                    <label className="text-sm font-medium text-neutral-600">Requirements</label>
                    <p className="text-neutral-900 whitespace-pre-wrap">{(event as any).requirements}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Voting Section */}
            {(event as any).enableVoting && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Vote className="w-5 h-5 mr-2" />
                    Attendance Voting
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{attendingCount}</div>
                      <div className="text-sm text-neutral-600">Attending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{notAttendingCount}</div>
                      <div className="text-sm text-neutral-600">Not Attending</div>
                    </div>
                  </div>

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
                          Your vote: <span className="font-medium capitalize">{userAttendance.status.replace('_', ' ')}</span>
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
                          className="flex-1"
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Attending
                        </Button>
                        <Button
                          onClick={() => voteMutation.mutate("not_attending")}
                          disabled={voteMutation.isPending}
                          variant="outline"
                          className="flex-1 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Not Attending
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Attendance List */}
          {(event as any).enableVoting && attendance && (attendance as any[]).length > 0 && (
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
    </div>
  );
}