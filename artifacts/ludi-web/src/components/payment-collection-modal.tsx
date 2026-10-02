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
import { apiRequest } from "@/lib/queryClient";
import { calculateTotalAmount, calculatePerPersonCost } from "@/lib/payment-utils";
import type { PlatformCharge, TeamMember, AttendanceRecord } from "@/types";

interface OrganiserStatus {
  payoutsEnabled?: boolean;
}

interface PaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  eventCost: string;
  eventCreatorId: string;
  maxPlayerPayment: string;
  venueOrganiserId?: string;
}

export function PaymentCollectionModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  eventCost,
  eventCreatorId,
  maxPlayerPayment,
  venueOrganiserId,
}: PaymentCollectionModalProps) {
  const [selectedOrganiserId, setSelectedOrganiserId] = useState<string>(venueOrganiserId || eventCreatorId);
  const [venueCost, setVenueCost] = useState<string>(eventCost);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedOrganiserId(venueOrganiserId || eventCreatorId);
      setVenueCost(eventCost);
      setSelectedAttendees([]);
      setAttendeesExpanded(false);
    }
  }, [isOpen, eventCreatorId, eventCost, venueOrganiserId]);

  // Fetch team members for organiser selection
  const { data: teamMembers = [], isLoading: loadingMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/events", eventId, "team-members"],
    enabled: isOpen,
  });

  // Fetch event attendance to get attendees
  const { data: attendance = [], isLoading: loadingAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/events", eventId, "attendance"],
    enabled: isOpen,
  });

  // Fetch platform charges for payment calculation
  const { data: platformCharges = [] } = useQuery<PlatformCharge[]>({
    queryKey: ["/api/platform-charges"],
    enabled: isOpen,
  });

  // Fetch organiser Connect status
  const { data: organiserStatus = {}, isLoading: loadingStatus } = useQuery<OrganiserStatus>({
    queryKey: [`/api/events/${eventId}/organiser-payout-status`],
    enabled: isOpen,
  });

  // Initialize selected attendees with those who voted to attend
  useEffect(() => {
    if (Array.isArray(teamMembers) && Array.isArray(attendance) && attendance.length > 0) {
      const attendingIds = attendance
        .filter((vote) => vote.status === "can_attend" || vote.status === "attending")
        .map((vote) => vote.userId);
      setSelectedAttendees(attendingIds);
    }
  }, [teamMembers, attendance]);

  const collectPaymentMutation = useMutation({
    mutationFn: async (data: {
      eventId: string;
      venueCost: string;
    }) => {
      const response = await apiRequest("POST", `/api/events/${data.eventId}/collect-payment`, {
        venueCost: data.venueCost,
      });
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
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to collect payments";
      toast({
        title: "Payment Collection Failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const perPersonCost = calculatePerPersonCost(venueCost, selectedAttendees.length, platformCharges);
  const baseCostPerPerson = parseFloat(venueCost || "0") / (selectedAttendees.length || 1);
  const costBreakdown = calculateTotalAmount(baseCostPerPerson, platformCharges);
  const holdAmount = calculateTotalAmount(maxPlayerPayment || "0", platformCharges).total;
  const exceedsHold = holdAmount > 0 && perPersonCost > holdAmount;

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

    collectPaymentMutation.mutate({ 
      eventId, 
      venueCost,
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
  const allMembersWithVotes = Array.isArray(teamMembers)
    ? teamMembers
        .map((member) => {
          const attendanceVote = Array.isArray(attendance)
            ? attendance.find((vote) => vote.userId === member.userId)
            : undefined;
          return {
            ...member,
            vote: attendanceVote?.status || null,
            isAttending:
              attendanceVote?.status === "can_attend" ||
              attendanceVote?.status === "attending",
          };
        })
        .sort((a, b) => {
          // Sort by: attending first, then alphabetical by name
          if (a.isAttending && !b.isAttending) return -1;
          if (!a.isAttending && b.isAttending) return 1;
          const aName = `${a.user?.firstName || ""} ${a.user?.lastName || ""}`.trim();
          const bName = `${b.user?.firstName || ""} ${b.user?.lastName || ""}`.trim();
          return aName.localeCompare(bName);
        })
    : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Collect Event Payments
          </DialogTitle>
          <DialogDescription>
            Configure payment collection for {eventName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 py-4">
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
            
            {/* Cost Breakdown Display */}
            {venueCost && parseFloat(venueCost) > 0 && selectedAttendees.length > 0 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2 text-sm">Cost Breakdown Per Person</h4>
                <div className="space-y-1 text-xs">
                  {costBreakdown.breakdown.map((item, index) => (
                    <div key={index} className={`flex justify-between ${
                      item.type === 'base' ? 'font-medium' : 'text-blue-700'
                    }`}>
                      <span>{item.name}</span>
                      <span>£{item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1 mt-2 flex justify-between font-medium text-blue-800">
                    <span>Total per Person:</span>
                    <span data-testid="text-total-per-person">£{perPersonCost.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Total to collect: £{(perPersonCost * selectedAttendees.length).toFixed(2)} from {selectedAttendees.length} attendees
                  </div>
                </div>
              </div>
            )}

            {exceedsHold && (
              <div
                className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-700 text-sm flex gap-2"
                data-testid="warning-hold-exceeded"
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Cost per player (£{perPersonCost.toFixed(2)}) exceeds the authorised hold amount (£{holdAmount.toFixed(2)}).
                  Existing holds will be cancelled and attendees will need to pay the new amount.
                </span>
              </div>
            )}
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
                        £{perPersonCost.toFixed(2)} each (inc. fees)
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
                      {allMembersWithVotes.map((member) => {
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
                                    `£${perPersonCost.toFixed(2)}`
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
                  {teamMembers.map((member) => (
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
                ) : organiserStatus?.payoutsEnabled ? (
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

              {!loadingStatus && !organiserStatus?.payoutsEnabled && (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-600">
                    This organiser must sign in to LUDI and complete Stripe payout setup before payments can be collected.
                  </p>
                  <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    LUDI does not collect participant funds for manual reimbursement outside Stripe Connect.
                  </div>
                </div>
              )}
            </div>
          )}

          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
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
              selectedAttendees.length === 0 ||
              !organiserStatus?.payoutsEnabled
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
      </DialogContent>
    </Dialog>
  );
}
