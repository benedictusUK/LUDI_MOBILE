import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  eventCost: string;
  eventCreatorId: string;
}

export function PaymentCollectionModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  eventCost,
  eventCreatorId,
}: PaymentCollectionModalProps) {
  const [selectedOrganiserId, setSelectedOrganiserId] = useState<string>(eventCreatorId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch team members for organiser selection
  const { data: teamMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["/api/events", eventId, "team-members"],
    enabled: isOpen,
  });

  // Fetch organiser Connect status
  const { data: organiserStatus = {}, isLoading: loadingStatus } = useQuery({
    queryKey: ["/api/connect/status", selectedOrganiserId],
    enabled: isOpen && !!selectedOrganiserId,
  });

  const collectPaymentMutation = useMutation({
    mutationFn: async (data: { eventId: string; organiserId: string }) => {
      const response = await fetch(`/api/events/${data.eventId}/collect-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organiserId: data.organiserId }),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to collect payments");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Collection Complete",
        description: `Successfully collected £${data.totalAmount} from ${data.successfulCaptures} payments${data.failedCaptures > 0 ? ` (${data.failedCaptures} failed)` : ''}`,
      });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: any) => {
      toast({
        title: "Payment Collection Failed",
        description: error.message || "Failed to collect payments",
        variant: "destructive",
      });
    },
  });

  const createConnectAccountMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/connect/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create Connect account");
      return response.json();
    },
    onSuccess: (data) => {
      // Open the onboarding link in a new tab
      window.open(data.url, "_blank");
      toast({
        title: "Connect Account Setup",
        description: "Please complete the setup in the new tab, then return here.",
      });
      // Refetch status after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/connect/status", selectedOrganiserId] });
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to start Connect account setup",
        variant: "destructive",
      });
    },
  });

  const handleCollectPayment = () => {
    if (!selectedOrganiserId) {
      toast({
        title: "Selection Required",
        description: "Please select a venue organiser",
        variant: "destructive",
      });
      return;
    }

    if (!(organiserStatus as any)?.payoutsEnabled) {
      toast({
        title: "Setup Required",
        description: "The selected organiser needs to complete their payout setup first",
        variant: "destructive",
      });
      return;
    }

    collectPaymentMutation.mutate({ eventId, organiserId: selectedOrganiserId });
  };

  const selectedMember = (teamMembers as any[]).find((m: any) => m.userId === selectedOrganiserId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Collect Event Payments
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-sm text-neutral-900 mb-2">Event Details</h3>
            <div className="text-sm text-neutral-600 space-y-1">
              <div>Event: <span className="font-medium">{eventName}</span></div>
              <div>Cost: <span className="font-medium">£{parseFloat(eventCost).toFixed(2)}</span></div>
            </div>
          </div>

          <div>
            <Label htmlFor="organiser-select" className="text-sm font-medium">
              Venue Organiser
            </Label>
            <p className="text-xs text-neutral-500 mb-2">
              Select who should receive the collected payments
            </p>
            
            {loadingMembers ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select value={selectedOrganiserId} onValueChange={setSelectedOrganiserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organiser" />
                </SelectTrigger>
                <SelectContent>
                  {(teamMembers as any[]).map((member: any) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {member.user?.firstName?.[0] || member.user?.email?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          {member.user?.firstName} {member.user?.lastName}
                          {member.userId === eventCreatorId && " (Event Creator)"}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedOrganiserId && (
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Payout Status</span>
                {loadingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (organiserStatus as any)?.payoutsEnabled ? (
                  <Badge className="gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle size={12} />
                    Setup Required
                  </Badge>
                )}
              </div>

              {!loadingStatus && !(organiserStatus as any)?.payoutsEnabled && (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-600">
                    This organiser needs to set up their payout account to receive payments.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createConnectAccountMutation.mutate(selectedOrganiserId)}
                    disabled={createConnectAccountMutation.isPending}
                    className="w-full"
                  >
                    {createConnectAccountMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Set Up Payout Account
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCollectPayment}
              disabled={
                collectPaymentMutation.isPending ||
                !selectedOrganiserId ||
                !(organiserStatus as any)?.payoutsEnabled
              }
              className="flex-1"
              style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
            >
              {collectPaymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Collect Payments
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}