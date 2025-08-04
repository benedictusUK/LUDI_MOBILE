import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ArrowUp, ArrowDown, Clock, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReservePlayersManagerProps {
  eventId: string;
  isAdmin?: boolean;
}

export function ReservePlayersManager({ eventId, isAdmin = false }: ReservePlayersManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch reserve players
  const { data: reserves = [], isLoading: reservesLoading } = useQuery<any[]>({
    queryKey: ["/api/events", eventId, "reserves"],
  });

  // Fetch event capacity info
  const { data: capacity, isLoading: capacityLoading } = useQuery<any>({
    queryKey: ["/api/events", eventId, "capacity"],
  });

  // Fetch all attendance for context
  const { data: attendance = [], isLoading: attendanceLoading } = useQuery<any[]>({
    queryKey: ["/api/events", eventId, "attendance"],
  });

  // Promotion mutation
  const promotePlayerMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/events/${eventId}/promote-reserve`, "POST", { userId });
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({
        title: "Player Promoted",
        description: "Reserve player has been promoted to main event.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to promote player",
        variant: "destructive",
      });
    },
  });

  // Demotion mutation
  const demotePlayerMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/events/${eventId}/demote-to-reserve`, "POST", { userId });
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      toast({
        title: "Player Moved to Reserve",
        description: "Player has been moved to reserve list.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move player to reserve",
        variant: "destructive",
      });
    },
  });

  const handlePromotePlayer = (userId: string) => {
    promotePlayerMutation.mutate(userId);
  };

  const handleDemotePlayer = (userId: string) => {
    demotePlayerMutation.mutate(userId);
  };

  const attendingPlayers = (attendance as any[]).filter((a: any) => a.status === "attending");

  if (reservesLoading || capacityLoading || attendanceLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Reserve Players
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Capacity Overview */}
      {capacity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Event Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {(capacity as any).attendingCount}
                </div>
                <div className="text-sm text-gray-600">Attending</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {(capacity as any).reserveCount}
                </div>
                <div className="text-sm text-gray-600">In Reserve</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {(capacity as any).availableSpots === -1 ? "∞" : (capacity as any).availableSpots}
                </div>
                <div className="text-sm text-gray-600">Available Spots</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {(capacity as any).availableReserveSpots}
                </div>
                <div className="text-sm text-gray-600">Reserve Spots</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reserve Players List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Reserve Players ({reserves.length})
          </CardTitle>
          <CardDescription>
            Players waiting to join the main event when spots become available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(reserves as any[]).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No reserve players yet</p>
              <p className="text-sm">Reserve players will appear here when the event is full</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(reserves as any[]).map((reserve: any, index: number) => (
                <div
                  key={reserve.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={reserve.user.profileImageUrl} />
                      <AvatarFallback>
                        {reserve.user.firstName?.[0]}{reserve.user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {reserve.user.firstName} {reserve.user.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        Reserved {new Date(reserve.votedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePromotePlayer(reserve.userId)}
                        disabled={promotePlayerMutation.isPending}
                        className="flex items-center gap-1"
                        title={(capacity as any)?.maxParticipants && (capacity as any).attendingCount >= (capacity as any).maxParticipants 
                          ? "Admin can promote reserves even when at capacity (creates overflow)" 
                          : "Promote reserve player to main event"}
                      >
                        <ArrowUp className="h-4 w-4" />
                        Promote
                        {(capacity as any)?.maxParticipants && (capacity as any).attendingCount >= (capacity as any).maxParticipants && (
                          <span className="text-xs text-orange-600 ml-1">(Overflow)</span>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Event Players - Admin Only */}
      {isAdmin && attendingPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Main Event Players ({attendingPlayers.length})
            </CardTitle>
            <CardDescription>
              Players confirmed for the main event
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attendingPlayers.map((player: any) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={player.user.profileImageUrl} />
                      <AvatarFallback>
                        {player.user.firstName?.[0]}{player.user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {player.user.firstName} {player.user.lastName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        Confirmed {new Date(player.votedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Attending
                    </Badge>
                    {isAdmin && capacity && (capacity as any).reserveSpots > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDemotePlayer(player.userId)}
                        disabled={
                          demotePlayerMutation.isPending ||
                          (capacity as any).reserveCount >= (capacity as any).reserveSpots
                        }
                        className="flex items-center gap-1 whitespace-nowrap"
                      >
                        <ArrowDown className="h-4 w-4" />
                        To Reserve
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}