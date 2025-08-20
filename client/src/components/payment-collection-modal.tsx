import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Users, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const [venueCost, setVenueCost] = useState<string>(eventCost);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedOrganiserId(eventCreatorId);
      setVenueCost(eventCost);
      setSelectedAttendees([]);
      setAttendeesExpanded(false);
    }
  }, [isOpen, eventCreatorId, eventCost]);

  // Fetch team members for organiser selection
  const { data: teamMembers = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["/api/events", eventId, "team-members"],
    enabled: isOpen,
  });

  // Fetch event attendance to get attendees
  const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ["/api/events", eventId, "attendance"],
    enabled: isOpen,
  });

  // Fetch organiser Connect status
  const { data: organiserStatus = {}, isLoading: loadingStatus } = useQuery({
    queryKey: ["/api/connect/status", selectedOrganiserId],
    enabled: isOpen && !!selectedOrganiserId,
  });

  // Initialize selected attendees with those who voted to attend
  useEffect(() => {
    if (Array.isArray(teamMembers) && Array.isArray(attendance) && attendance.length > 0) {
      const attendingIds = attendance
        .filter((vote: any) => vote.status === "can_attend" || vote.status === "attending")
        .map((vote: any) => vote.userId);
      setSelectedAttendees(attendingIds);
    }
  }, [teamMembers, attendance]);

  const collectPaymentMutation = useMutation({
    mutationFn: async (data: { 
      eventId: string; 
      organiserId: string; 
      venueCost: string; 
      attendeeIds: string[] 
    }) => {
      const response = await fetch(`/api/events/${data.eventId}/collect-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          organiserId: data.organiserId,
          venueCost: data.venueCost,
          attendeeIds: data.attendeeIds
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to collect payments");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const organizerNote = data.organizerExcluded ? " (venue organizer excluded from charges)" : "";
      toast({
        title: "Payment Collection Complete",
        description: `Successfully collected £${data.totalAmount} from ${data.successfulCaptures} payments${data.failedCaptures > 0 ? ` (${data.failedCaptures} failed)` : ''}${organizerNote}`,
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
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create Connect account");
      }
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
      const isConnectNotEnabled = error.message?.includes("signed up for Connect");
      toast({
        title: "Setup Failed",
        description: isConnectNotEnabled 
          ? "Stripe Connect is not enabled for this account. Please contact support to enable Connect functionality."
          : error.message || "Failed to start Connect account setup",
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

    if (!venueCost || parseFloat(venueCost) <= 0) {
      toast({
        title: "Invalid Venue Cost",
        description: "Please enter a valid venue cost",
        variant: "destructive",
      });
      return;
    }

    // Count attendees excluding the organizer for validation
    const chargeableAttendees = selectedAttendees.filter(id => id !== selectedOrganiserId);
    
    if (selectedAttendees.length === 0) {
      toast({
        title: "No Attendees Selected",
        description: "Please select at least one attendee",
        variant: "destructive",
      });
      return;
    }
    
    if (chargeableAttendees.length === 0 && selectedAttendees.includes(selectedOrganiserId)) {
      toast({
        title: "Payment Collection Not Needed",
        description: "Only the venue organizer is selected. Since they pay themselves, no payment collection is required.",
        variant: "destructive",
      });
      return;
    }

    // Allow payment collection even without Connect setup for now
    // The platform will collect payments and organiser reimbursement can be handled manually

    collectPaymentMutation.mutate({ 
      eventId, 
      organiserId: selectedOrganiserId,
      venueCost,
      attendeeIds: selectedAttendees
    });
  };

  const toggleAttendee = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedAttendees([...selectedAttendees, userId]);
    } else {
      setSelectedAttendees(selectedAttendees.filter(id => id !== userId));
    }
  };

  // Create a combined list of all team members with their attendance status
  const allMembersWithVotes = Array.isArray(teamMembers) ? (teamMembers as any[]).map((member: any) => {
    const attendanceVote = Array.isArray(attendance) ? 
      attendance.find((vote: any) => vote.userId === member.userId) : null;
    return {
      ...member,
      vote: attendanceVote?.status || null,
      isAttending: attendanceVote?.status === "can_attend" || attendanceVote?.status === "attending"
    };
  }).sort((a: any, b: any) => {
    // Sort by: attending first, then alphabetical by name
    if (a.isAttending && !b.isAttending) return -1;
    if (!a.isAttending && b.isAttending) return 1;
    const aName = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim();
    const bName = `${b.user?.firstName || ''} ${b.user?.lastName || ''}`.trim();
    return aName.localeCompare(bName);
  }) : [];

  const selectedMember = (teamMembers as any[]).find((m: any) => m.userId === selectedOrganiserId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Collect Event Payments
          </DialogTitle>
          <DialogDescription>
            Configure payment collection for {eventName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Venue Cost Section */}
          <div>
            <Label htmlFor="venue-cost" className="text-sm font-medium text-red-600">
              Venue Cost (Required) *
            </Label>
            <p className="text-xs text-neutral-500 mb-2">
              Confirm the total venue cost to be split among attendees
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500">£</span>
              <Input
                id="venue-cost"
                type="number"
                step="0.01"
                min="0"
                value={venueCost}
                onChange={(e) => setVenueCost(e.target.value)}
                className="pl-8"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Attendees Section */}
          <div>
            <Label className="text-sm font-medium text-red-600">
              Attendees to Charge (Required) *
            </Label>
            <p className="text-xs text-neutral-500 mb-2">
              Select who should be charged for this event
            </p>
            
            <div className="border rounded-lg p-3">
              <Collapsible open={attendeesExpanded} onOpenChange={setAttendeesExpanded}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Selected: {selectedAttendees.length} attendees
                    </span>
                    {selectedAttendees.length > 0 && (
                      <Badge variant="secondary">
                        £{(parseFloat(venueCost || "0") / selectedAttendees.length).toFixed(2)} each
                      </Badge>
                    )}
                    {selectedAttendees.includes(selectedOrganiserId) && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Organizer: N/A charge
                      </Badge>
                    )}
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {attendeesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="space-y-2">
                  {loadingAttendance || loadingMembers ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {allMembersWithVotes.map((member: any) => {
                        const getStatusText = () => {
                          if (member.vote === "can_attend" || member.vote === "attending") return "Voted to attend";
                          if (member.vote === "cant_attend") return "Can't attend";
                          return "No response";
                        };

                        const getStatusColor = () => {
                          if (member.vote === "can_attend" || member.vote === "attending") return "text-green-600";
                          if (member.vote === "cant_attend") return "text-red-500";
                          return "text-neutral-500";
                        };

                        return (
                          <div 
                            key={member.userId} 
                            className={`flex items-center space-x-3 p-2 hover:bg-neutral-50 rounded ${
                              member.isAttending ? 'bg-green-50 border border-green-200' : ''
                            }`}
                          >
                            <Checkbox
                              checked={selectedAttendees.includes(member.userId)}
                              onCheckedChange={(checked) => toggleAttendee(member.userId, !!checked)}
                              data-testid={`checkbox-attendee-${member.userId}`}
                            />
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {member.user?.firstName?.[0] || member.user?.email?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="text-sm font-medium">
                                {member.user?.firstName} {member.user?.lastName}
                                {member.isAttending && (
                                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                    Attending
                                  </span>
                                )}
                                {member.userId === selectedOrganiserId && (
                                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                    Venue Organizer
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs ${getStatusColor()}`}>
                                {getStatusText()}
                              </div>
                            </div>
                            {selectedAttendees.includes(member.userId) && (
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {member.userId === selectedOrganiserId ? (
                                    <span className="text-amber-600">N/A</span>
                                  ) : (
                                    `£${(parseFloat(venueCost || "0") / selectedAttendees.length).toFixed(2)}`
                                  )}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  {member.userId === selectedOrganiserId ? "Organizer pays self" : "Charge amount"}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {allMembersWithVotes.length === 0 && (
                        <div className="text-center py-4 text-neutral-500 text-sm">
                          No team members found
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          {/* Venue Organiser Section */}
          <div>
            <Label htmlFor="organiser-select" className="text-sm font-medium text-red-600">
              Venue Organiser (Required) *
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
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    <strong>Note:</strong> For now, you can collect payments without organiser setup. 
                    The venue organiser will need to be reimbursed manually outside the platform.
                  </div>
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
                    Try Set Up Payout Account
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
                !venueCost ||
                parseFloat(venueCost) <= 0 ||
                selectedAttendees.length === 0
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