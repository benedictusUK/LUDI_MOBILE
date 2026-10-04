import { apiErrorMessage } from "@/lib/apiError";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useScrollToTop } from "@/hooks/useScrollToTop";
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
import { useToast } from "@/hooks/use-toast";
import { FlareGunModal } from "@/components/ui/flare-gun-modal";
import { ReservePlayersManager } from "@/components/ui/reserve-players-manager";
import { EventPayment } from "@/components/event-payment";
import { PaymentCollectionModal } from "@/components/payment-collection-modal";
import PaymentAuthorizationModal from "@/components/payment-authorization-modal";

export default function EventDetails() {
  useScrollToTop();
  const [, params] = useRoute("/events/:id");
  const eventId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const [voteDetailsModal, setVoteDetailsModal] = useState<{
    isOpen: boolean;
    type: "attending" | "not_attending" | "no_response";
    voters: any[];
  }>({
    isOpen: false,
    type: "attending",
    voters: [],
  });

  const [paymentCollectionModal, setPaymentCollectionModal] = useState<{
    isOpen: boolean;
    eventId: string;
    eventName: string;
    eventCost: string;
    eventCreatorId: string;
    maxPlayerPayment: string;
    venueOrganiserId?: string;
  }>({
    isOpen: false,
    eventId: "",
    eventName: "",
    eventCost: "",
    eventCreatorId: "",
    maxPlayerPayment: "",
    venueOrganiserId: "",
  });

  const [paymentAuthModal, setPaymentAuthModal] = useState(false);

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

  // Fetch payment status for events that require payment
  const { data: paymentStatus } = useQuery({
    queryKey: ["/api/events", eventId, "payment-status"],
    enabled: !!eventId && !!event && (!!(event as any)?.paymentRequired || (!!(event as any)?.cost && parseFloat((event as any).cost) > 0)),
    staleTime: 30000, // Cache for 30 seconds
  });

  const { data: paymentQuote } = useQuery<any>({
    queryKey: ["/api/events", eventId, "payment-policy"],
    enabled: !!eventId && !!event && !!(event as any)?.paymentRequired,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  const policyMode: string =
    paymentQuote?.paymentPolicy && paymentQuote.paymentPolicy !== "none"
      ? paymentQuote.paymentPolicy
      : (event as any)?.paymentPolicy && (event as any).paymentPolicy !== "none"
        ? (event as any).paymentPolicy
        : "flexible_post_event";
  const isFixedPolicy = policyMode === "fixed_immediate" || policyMode === "fixed_threshold";

  // Vote mutation with payment authorization handling
  const voteMutation = useMutation({
    mutationFn: async (status: "attending" | "not_attending") => {
      const response = await fetch(`/api/events/${eventId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // If payment authorization is required, show the modal
        if (response.status === 402 || response.status === 400 && errorData.requiresPaymentAuth) {
          setPaymentAuthModal(true);
          throw new Error("PAYMENT_AUTHORIZATION_REQUIRED");
        }
        
        throw new Error(errorData.details || errorData.message || "Failed to vote");
      }
      
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
      
      // Handle different types of errors
      const errorMessage = err.message;
      if (errorMessage === "PAYMENT_AUTHORIZATION_REQUIRED") {
        // Don't show error toast for payment authorization since the modal will handle it
        return;
      } else if (errorMessage.includes("Payment method required")) {
        toast({
          title: "Payment Method Required",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (errorMessage.includes("Payment authorization failed")) {
        toast({
          title: "Payment Authorization Failed",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage || "Failed to update your attendance. Please try again.",
          variant: "destructive",
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "potential-players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "capacity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "reserves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "payment-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "payment-policy"] });
    },
  });

  // Unvote mutation with optimistic updates
  const unvoteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/events/${eventId}/vote`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
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
      toast({
        title: "Could not remove your vote",
        description: apiErrorMessage(err, "Failed to unvote. Please try again."),
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      // Show success message for unvoting from paid events
      if (eventData?.paymentRequired && data?.refundStatus) {
        toast({
          title: "Payment refund",
          description: data.message || `Your refund is ${String(data.refundStatus).replace(/_/g, " ")}.`,
        });
      } else if (eventData?.paymentRequired && data?.paymentReleased) {
        toast({
          title: "Payment Authorization Released",
          description: `${isFixedPolicy || eventData.feeConfiguration ? 'Your withdrawal has been processed; your refund follows the event policy.' : 'Your payment hold of up to £' + parseFloat(eventData.maxPlayerPayment || '0').toFixed(2) + ' has been cancelled. You will not be charged.'}`,
        });
      } else {
        toast({
          title: "Unvoted Successfully",
          description: "You have been removed from this event.",
        });
      }
    },
    onSettled: () => {
      // Always refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "potential-players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "capacity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "reserves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "payment-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "payment-policy"] });
    },
  });

  // Helper function to check if event is in the past
  const isEventPast = (event: any): boolean => {
    const now = new Date();
    
    // Calculate actual event end time
    let eventEndTime: Date;
    if (event.endDate && event.endTime) {
      eventEndTime = new Date(`${event.endDate} ${event.endTime}`);
    } else if (event.startDate && event.endTime) {
      eventEndTime = new Date(`${event.startDate} ${event.endTime}`);
    } else {
      // Fallback to end of start date if no end time specified
      eventEndTime = new Date(event.startDate);
      eventEndTime.setHours(23, 59, 59);
    }
    
    return eventEndTime < now;
  };



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
              <h1 className="text-3xl font-bold text-white mb-4">{eventData.name}</h1>
              <div className="space-y-2 text-white/90">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {new Date(eventData.startDate).toLocaleDateString()}
                  <Clock className="w-4 h-4 ml-4 mr-2" />
                  {eventData.startTime}
                </div>
                {eventData.location && (
                  <div className="flex items-center" title={eventData.location}>
                    <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{eventData.location}</span>
                  </div>
                )}
                {eventData.primaryTeam && (
                  <div className="flex items-center" title={`Primary Team: ${eventData.primaryTeam.name}`}>
                    <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>Primary Team: {eventData.primaryTeam.name}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <Badge 
                variant={eventData.isPublished ? "default" : "secondary"}
                className="bg-white/20 text-white border-white/30"
              >
                {eventData.isPublished ? "Published" : "Draft"}
              </Badge>
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
                    <label className="text-sm font-medium text-neutral-600">{(event as any).paymentRequired ? isFixedPolicy ? "Price per player" : "Maximum per player" : "Cost"}</label>
                    <p className="text-neutral-900">
                      {(event as any).paymentRequired
                        ? `£${(isFixedPolicy ? Number((event as any).fixedPriceMinor || 0) / 100 : Number((event as any).maxPlayerPayment || 0)).toFixed(2)} GBP`
                        : (!(event as any).cost || parseFloat((event as any).cost) === 0) ? "Free" : `£${parseFloat((event as any).cost).toFixed(2)}`}
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
                
                {(event as any).paymentRequired && (
                  <div className="rounded-lg border border-neutral-200 p-3 text-sm" data-testid="text-payment-policy">
                    <div className="font-medium text-neutral-800">
                      {isFixedPolicy
                        ? `Fixed price: £${(paymentQuote?.amountMinor != null ? paymentQuote.amountMinor / 100 : parseFloat((event as any).maxPlayerPayment || "0")).toFixed(2)} GBP`
                        : (event as any).feeConfiguration
                          ? `Flexible: pay £${(paymentQuote?.amountMinor != null ? paymentQuote.amountMinor / 100 : parseFloat((event as any).maxPlayerPayment || "0")).toFixed(2)} GBP upfront`
                          : `Flexible: hold up to £${parseFloat((event as any).maxPlayerPayment || "0").toFixed(2)} GBP`}
                    </div>
                    <p className="text-neutral-600 mt-1">
                      {policyMode === "fixed_immediate" && "Charged upfront when you join. Fees are included. Full refund if you withdraw before the deadline."}
                      {policyMode === "fixed_threshold" && `Charged upfront. Refunded if fewer than ${paymentQuote?.minimumPaidParticipants ?? "the minimum"} people have paid by the deadline.`}
                      {!isFixedPolicy && ((event as any).feeConfiguration
                        ? "Pay the maximum venue share plus fees now. Unused venue cost is refunded after finalisation; both original fee amounts stay fixed."
                        : "A cap is authorised now and the actual cost is settled after the event.")}
                    </p>
                    {paymentQuote?.paymentDeadlineAt && (
                      <p className="text-neutral-600 mt-1">Payment deadline: {new Date(paymentQuote.paymentDeadlineAt).toLocaleString()}</p>
                    )}
                    {paymentQuote && paymentQuote.canPay === false && paymentQuote.reason && (
                      <p className="text-amber-700 mt-1">{paymentQuote.reason}</p>
                    )}
                  </div>
                )}

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
                        {!isEventPast(eventData) ? (
                          <Button
                            onClick={() => unvoteMutation.mutate()}
                            disabled={unvoteMutation.isPending}
                            variant="outline"
                            className="flex-1"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Unvote
                          </Button>
                        ) : (
                          <div className="flex-1 text-sm text-neutral-600 p-2 text-center">
                            <span className="font-medium text-neutral-800">Event Finished</span>
                            <br />
                            <span className="text-xs">Voting is no longer available</span>
                          </div>
                        )}
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
                        {!isEventPast(eventData) ? (
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
                        ) : (
                          <div className="flex-1 text-sm text-neutral-600 p-4 text-center bg-neutral-50 rounded-lg border">
                            <span className="font-medium text-neutral-800">Event Finished</span>
                            <br />
                            <span className="text-xs">Voting is no longer available for past events</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Payment Section - Shows when user has voted to attend and event has cost */}
                  {userAttendance?.status === "attending" && eventData.paymentRequired && (user as any)?.id !== (eventData.venueOrganiserId || eventData.createdById) && (
                    <div className="p-4 border rounded-lg" data-testid="card-fixed-payment">
                      {(paymentStatus as any)?.hasAuthorization ? (
                        <div className="text-green-800">
                          <div className="font-medium">{isFixedPolicy ? "Paid" : (paymentStatus as any)?.status === "captured" ? "Settled" : "Authorized up to"} £{((paymentStatus as any)?.status === "captured" && (paymentStatus as any)?.paymentRecord?.capturedAmountMinor != null ? (paymentStatus as any).paymentRecord.capturedAmountMinor / 100 : paymentQuote?.amountMinor != null ? paymentQuote.amountMinor / 100 : parseFloat(eventData.maxPlayerPayment || "0")).toFixed(2)} GBP</div>
                          <p className="text-sm text-neutral-600 mt-1">
                            {!isFixedPolicy ? "The actual venue share is settled after the event, within the agreed cap and settlement deadline." : policyMode === "fixed_threshold"
                              ? `Refunded automatically if fewer than ${paymentQuote?.minimumPaidParticipants ?? "the minimum"} people have paid by the deadline.`
                              : "You can withdraw for a full refund before the payment deadline. Refunds may show as processing for a few days."}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-neutral-700">
                            Your place is not confirmed until you {isFixedPolicy || eventData.feeConfiguration ? "pay" : "authorize up to"} £{(paymentQuote?.amountMinor != null ? paymentQuote.amountMinor / 100 : parseFloat(eventData.maxPlayerPayment || "0")).toFixed(2)} GBP.
                            {paymentQuote?.canPay === false && paymentQuote?.reason && <span className="block text-amber-700">{paymentQuote.reason}</span>}
                          </div>
                          <Button onClick={() => setPaymentAuthModal(true)} disabled={paymentQuote?.canPay === false} data-testid="button-pay-fixed">
                            Pay now
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {userAttendance?.status === "attending" && !eventData.paymentRequired && eventData.cost && parseFloat(eventData.cost) > 0 && (user as any)?.id !== eventData.venueOrganiserId && (
                    <EventPayment
                      eventId={eventId!}
                      eventName={eventData.name}
                      eventCost={parseFloat(eventData.cost)}
                      userId={(user as any)?.id}
                      hasVotedAttending={true}
                      onPaymentSuccess={() => {
                        // Refresh event data and payment status after successful payment setup
                        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
                        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "payment-status"] });
                      }}
                    />
                  )}

                  {/* Payment Requirement Notice - Shows for paid events when user hasn't voted yet */}
                  {!userAttendance && eventData.paymentRequired && eventData.maxPlayerPayment && parseFloat(eventData.maxPlayerPayment) > 0 && (user as any)?.id !== (eventData.venueOrganiserId || eventData.createdById) && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="text-amber-600 font-medium">{isFixedPolicy || eventData.feeConfiguration ? "Upfront Payment Required" : "Payment Authorization Required"}</div>
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                          {isFixedPolicy || eventData.feeConfiguration ? "" : "Up to "}£{(paymentQuote?.amountMinor != null ? paymentQuote.amountMinor / 100 : parseFloat(eventData.maxPlayerPayment)).toFixed(2)} GBP
                        </Badge>
                      </div>
                      <p className="text-sm text-amber-700 mt-1">
                        {eventData.feeConfiguration ? "Pay the maximum venue share plus fees to confirm attendance. Unused venue cost is refunded; original fees stay fixed." : "You'll need to set up a payment method before confirming your attendance for this event."}
                      </p>
                      <Button className="mt-3" onClick={() => setPaymentAuthModal(true)} disabled={!paymentQuote || paymentQuote.canPay === false} data-testid="button-start-event-payment">
                        {isFixedPolicy || eventData.feeConfiguration ? "Continue to payment" : "Authorize payment"}
                      </Button>
                    </div>
                  )}

                  {/* Collect Payment Button for Past Events (Admin Only) */}
                  {eventData && isEventPast(eventData) && 
                   (eventData.feeConfiguration ? policyMode === "flexible_post_event" : eventData.cost && parseFloat(eventData.cost) > 0) &&
                   !isFixedPolicy &&
                   (!eventData.paymentCollectionInitiated || (eventData.feeConfiguration && eventData.paymentStatus === "partial_captured")) &&
                   user && eventData.primaryTeam && (
                     eventData.primaryTeam.ownerId === (user as any).id || 
                     eventData.primaryTeam.memberships?.some((m: any) => 
                       m.userId === (user as any).id && ['admin', 'captain'].includes(m.role)
                     )
                   ) && (
                    <Card className="mb-6">
                      <CardContent className="pt-6">
                        <div className="flex flex-col space-y-4">
                          <div className="text-center">
                            <h3 className="text-lg font-semibold text-neutral-900 mb-2">{eventData.feeConfiguration ? "Finalise venue cost and refunds" : "Event Payment Collection"}</h3>
                            <p className="text-sm text-neutral-600 mb-4">
                              {eventData.feeConfiguration ? "Confirm the final venue cost and refund unused venue shares. Original platform and processing fees stay fixed." : "This event has finished. You can now collect payments from attendees who have authorized payment holds."}
                            </p>
                          </div>
                          <Button 
                            onClick={() => {
                              if (eventData && eventId) {
                                setPaymentCollectionModal({
                                  isOpen: true,
                                  eventId: eventId,
                                  eventName: eventData.name,
                                  eventCost: eventData.cost || "0",
                                  eventCreatorId: eventData.createdById,
                                  maxPlayerPayment: eventData.maxPlayerPayment || "0",
                                  venueOrganiserId: eventData.venueOrganiserId || eventData.createdById,
                                });
                              }
                            }}
                            disabled={!eventId || !eventData}
                            className="w-full"
                            style={{ 
                              backgroundColor: "#10b981",
                              borderColor: "#10b981"
                            }}
                          >
                            Collect Payments
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Payment Collection Completed Message for Past Events */}
                  {eventData && isEventPast(eventData) && 
                   eventData.cost && parseFloat(eventData.cost) > 0 && 
                   eventData.paymentCollectionInitiated &&
                   user && eventData.primaryTeam && (
                     eventData.primaryTeam.ownerId === (user as any).id || 
                     eventData.primaryTeam.memberships?.some((m: any) => 
                       m.userId === (user as any).id && ['admin', 'captain'].includes(m.role)
                     )
                   ) && (
                    <Card className="mb-6">
                      <CardContent className="pt-6">
                        <div className="flex flex-col space-y-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-3">
                              <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
                              <h3 className="text-lg font-semibold text-green-800">Payment Collection Completed</h3>
                            </div>
                            <p className="text-sm text-neutral-600 mb-2">
                              Payment collection has already been initiated for this event.
                            </p>
                            {eventData.paymentCollectionInitiatedAt && (
                              <p className="text-xs text-neutral-500">
                                Collection initiated on {new Date(eventData.paymentCollectionInitiatedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

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

      <PaymentCollectionModal
        isOpen={paymentCollectionModal.isOpen}
        onClose={() => setPaymentCollectionModal({
          isOpen: false,
          eventId: "",
          eventName: "",
          eventCost: "",
          eventCreatorId: "",
          maxPlayerPayment: "",
          venueOrganiserId: "",
        })}
        eventId={paymentCollectionModal.eventId}
        eventName={paymentCollectionModal.eventName}
        eventCost={paymentCollectionModal.eventCost}
        eventCreatorId={paymentCollectionModal.eventCreatorId}
        maxPlayerPayment={paymentCollectionModal.maxPlayerPayment}
        venueOrganiserId={paymentCollectionModal.venueOrganiserId}
      />

      <PaymentAuthorizationModal
        isOpen={paymentAuthModal}
        onClose={() => setPaymentAuthModal(false)}
        onSuccess={() => {
          // Refresh the attendance data after successful authorization
          queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
          queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
        }}
        event={eventData}
        maxPlayerPayment={eventData?.maxPlayerPayment ? parseFloat(eventData.maxPlayerPayment) : 0}
      />
    </div>
  );
}