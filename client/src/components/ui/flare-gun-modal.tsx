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


import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

import { 
  Target
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
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlareGunIcon className="h-5 w-5 text-red-500" />
            Flare Gun - Find Nearby Players
          </DialogTitle>

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


        </div>
      </DialogContent>
    </Dialog>
  );
}