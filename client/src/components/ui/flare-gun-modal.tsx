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

// Custom Flare Gun SVG Icon - Based on classic flare gun design
const FlareGunIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    className={className}
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Main barrel - wide, short, angled upward */}
    <path d="M30 45 L75 35 Q80 34 82 37 Q84 40 80 42 L35 52 Z" fill="currentColor" stroke="none" />
    
    {/* Barrel end with flare opening */}
    <ellipse cx="78" cy="38.5" rx="4" ry="2.5" fill="none" strokeWidth="1.5" />
    
    {/* Trigger mechanism housing */}
    <rect x="25" y="45" width="12" height="15" rx="2" fill="currentColor" stroke="none" />
    
    {/* Large trigger guard - characteristic of flare guns */}
    <path d="M20 52 Q15 52 12 57 Q10 62 12 67 Q15 72 20 72 L30 72" fill="none" strokeWidth="2.5" />
    
    {/* Trigger */}
    <path d="M22 60 Q19 62 19 65 Q19 68 22 68" fill="none" strokeWidth="2" />
    
    {/* Pistol grip with distinctive flare gun shape */}
    <path d="M30 52 L30 72 Q30 77 27 80 Q23 84 18 84 Q12 84 10 80 Q8 76 10 72 L14 67" fill="none" strokeWidth="2.5" />
    
    {/* Grip texture - crosshatch pattern typical of flare guns */}
    <line x1="25" y1="58" x2="25" y2="68" strokeWidth="1" />
    <line x1="22" y1="60" x2="22" y2="70" strokeWidth="1" />
    <line x1="19" y1="62" x2="19" y2="72" strokeWidth="1" />
    <line x1="16" y1="64" x2="16" y2="74" strokeWidth="1" />
    
    {/* Sight on top of barrel */}
    <rect x="65" y="32" width="2" height="4" rx="1" fill="currentColor" />
    
    {/* Safety catch */}
    <circle cx="35" cy="48" r="1.5" fill="currentColor" />
    
    {/* Flare spark effect */}
    <path d="M78 38.5 L85 36 L87 38.5 L85 41 Z" fill="currentColor" opacity="0.6" />
    <circle cx="88" cy="38.5" r="1" fill="currentColor" opacity="0.4" />
  </svg>
);

interface FlareGunModalProps {
  event: any;
  isAuthorized: boolean;
}

export function FlareGunModal({ event, isAuthorized }: FlareGunModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const { toast } = useToast();

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