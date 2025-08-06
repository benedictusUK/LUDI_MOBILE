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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SPORTS } from "@shared/schema";
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
  const [selectedSport, setSelectedSport] = useState<string>(event?.sport || "");
  const { toast } = useToast();

  // Auto-select event sport when modal opens
  React.useEffect(() => {
    if (isOpen && event?.sport) {
      setSelectedSport(event.sport);
    }
  }, [isOpen, event?.sport]);

  // Fetch flare responses for this event
  const { data: flareResponses = [], refetch: refetchResponses } = useQuery({
    queryKey: ["/api/events", event.id, "flare-responses"],
    enabled: isOpen,
  });

  // Send flare gun mutation
  const sendFlareMutation = useMutation({
    mutationFn: async (sport: string) => {
      const response = await apiRequest("POST", `/api/events/${event.id}/flare`, { sport });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🚀 Flare Gun Sent!",
        description: `Alert sent to ${data.recipientCount} nearby players interested in ${selectedSport}`,
      });
      setSelectedSport("");
      refetchResponses();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to send flare gun",
        description: error.message || "Something went wrong",
      });
    },
  });

  const handleSendFlare = () => {
    if (!selectedSport) {
      toast({
        variant: "destructive",
        title: "Please select a sport",
        description: "Choose which sport to advertise this event for",
      });
      return;
    }
    sendFlareMutation.mutate(selectedSport);
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

  const statusCounts = flareResponses?.reduce((acc: any, response: any) => {
    acc[response.status] = (acc[response.status] || 0) + 1;
    return acc;
  }, {}) || {};

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
          {/* Send Flare Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Send Flare Alert</h3>
            <div className="flex gap-3">
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select sport to advertise for..." />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleSendFlare}
                disabled={!selectedSport || sendFlareMutation.isPending}
              >
                {sendFlareMutation.isPending ? "Sending..." : "Send Flare 🚀"}
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              This will notify users within their travel radius who have this sport in their interests
              and aren't currently on any teams.
            </p>
          </div>

          {/* Responses Section */}
          {flareResponses && flareResponses.length > 0 && (
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
                {flareResponses.map((response: any) => (
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

          {flareResponses && flareResponses.length === 0 && (
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