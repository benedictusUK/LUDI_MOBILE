import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { 
  Target, 
  Users, 
  ThumbsUp, 
  ThumbsDown, 
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle
} from "lucide-react";
import flareGunIcon from "@assets/IMG_6963_1754302090076.webp";

// Flare Gun Icon using the provided image
const FlareGunIcon = ({ className }: { className?: string }) => (
  <img 
    src={flareGunIcon} 
    alt="Flare Gun" 
    className={className}
    style={{ filter: 'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)' }}
  />
);

interface FlareGunModalProps {
  event: any;
  isAuthorized: boolean;
}

export function FlareGunModal({ event, isAuthorized }: FlareGunModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Fetch flare responses for this event
  const { data: flareResponses = [], refetch: refetchResponses } = useQuery<any[]>({
    queryKey: ["/api/events", event.id, "flare-responses"],
    enabled: isOpen,
  });

  // Send flare gun mutation
  const sendFlareMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/events/${event.id}/flare`, { sport: event.sport });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🚀 Flare Gun Sent!",
        description: `Alert sent to ${data.recipientCount} nearby players interested in ${event.sport}`,
      });
      refetchResponses();
      // Invalidate event data to update flare status
      queryClient.invalidateQueries({ queryKey: ["/api/events", event.id] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send flare gun",
        description: error.message || "Something went wrong",
      });
    },
  });

  // Toggle flare status mutation
  const toggleFlareStatusMutation = useMutation({
    mutationFn: async (status: "active" | "inactive") => {
      const response = await apiRequest("POST", `/api/events/${event.id}/flare-status`, { status });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: `Flare ${data.flareStatus === 'active' ? 'Activated' : 'Deactivated'}`,
        description: `Event is ${data.flareStatus === 'active' ? 'now discoverable' : 'no longer discoverable'} in Flare Search`,
      });
      // Invalidate event data to update flare status
      queryClient.invalidateQueries({ queryKey: ["/api/events", event.id] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update flare status",
        description: error.message || "Something went wrong",
      });
    },
  });

  const handleSendFlare = () => {
    sendFlareMutation.mutate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "interested":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "not_interested":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "maybe":
        return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "interested":
        return "bg-green-100 text-green-800";
      case "not_interested":
        return "bg-red-100 text-red-800";
      case "maybe":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const statusCounts = Array.isArray(flareResponses) 
    ? flareResponses.reduce((acc: any, response: any) => {
        acc[response.status] = (acc[response.status] || 0) + 1;
        return acc;
      }, {}) 
    : {};

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {isAuthorized && (
          <Button variant="outline" size="sm">
            <FlareGunIcon className="h-4 w-4 mr-2" />
            Flare Gun
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlareGunIcon className="h-5 w-5 text-red-500" />
            Flare Gun - Find Nearby Players
          </DialogTitle>
          <DialogDescription>
            Send alerts to nearby users who aren't on teams but are interested in specific sports.
            Perfect for finding additional players when you need more people!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Flare Status Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Flare Status</h3>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${event.flareStatus === "active" ? "bg-orange-500" : "bg-gray-400"}`} />
                <div>
                  <p className="font-medium">
                    Event is {event.flareStatus === "active" ? "discoverable" : "not discoverable"} in Flare Search
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {event.flareStatus === "active" 
                      ? "Other users can find this event when searching for players to join"
                      : "Event is hidden from Flare Search results"
                    }
                  </p>
                </div>
              </div>
              <Button
                variant={event.flareStatus === "active" ? "destructive" : "default"}
                size="sm"
                onClick={() => toggleFlareStatusMutation.mutate(event.flareStatus === "active" ? "inactive" : "active")}
                disabled={toggleFlareStatusMutation.isPending}
              >
                {toggleFlareStatusMutation.isPending 
                  ? "Updating..." 
                  : event.flareStatus === "active" 
                    ? "Deactivate" 
                    : "Activate"
                }
              </Button>
            </div>
          </div>

          {/* Send Flare Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Send Flare Alert for {event.sport}</h3>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleSendFlare}
                disabled={sendFlareMutation.isPending}
                size="lg"
                className="w-full"
              >
                {sendFlareMutation.isPending ? "Sending Flare..." : "Send Flare Gun 🚀"}
              </Button>
              <p className="text-sm text-gray-600">
                This will notify users within their travel radius who have {event.sport} in their interests
                and aren't currently on teams associated with this event.
              </p>
            </div>
          </div>

          {/* Responses Section */}
          {Array.isArray(flareResponses) && flareResponses.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Flare Responses</h3>
                <div className="flex gap-2">
                  {statusCounts.interested && (
                    <Badge className="bg-green-100 text-green-800">
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      {statusCounts.interested} Interested
                    </Badge>
                  )}
                  {statusCounts.maybe && (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <HelpCircle className="h-3 w-3 mr-1" />
                      {statusCounts.maybe} Maybe
                    </Badge>
                  )}
                  {statusCounts.not_interested && (
                    <Badge className="bg-red-100 text-red-800">
                      <ThumbsDown className="h-3 w-3 mr-1" />
                      {statusCounts.not_interested} Not Interested
                    </Badge>
                  )}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {Array.isArray(flareResponses) && flareResponses.map((response: any) => (
                  <div
                    key={response.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {response.user.firstName?.[0]}{response.user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {response.user.firstName} {response.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          @{response.user.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(response.status)}>
                        {getStatusIcon(response.status)}
                        <span className="ml-1 capitalize">
                          {response.status.replace('_', ' ')}
                        </span>
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {new Date(response.respondedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(flareResponses) && flareResponses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No responses yet</p>
              <p className="text-sm">Send a flare to alert nearby players!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}