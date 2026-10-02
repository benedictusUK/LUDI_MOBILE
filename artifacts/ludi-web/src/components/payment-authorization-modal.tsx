import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { parseStripeError } from "@/lib/utils";
import type { PaymentEvent } from "@/types/payment";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CreditCard, Check, Smartphone, Wallet } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event: PaymentEvent;
  maxPlayerPayment: number;
  isFromNotification?: boolean; // New prop to differentiate notification-triggered modals
  notificationId?: string; // Pass notification ID for proper API calls
}

export default function PaymentAuthorizationModal({
  isOpen,
  onClose,
  onSuccess,
  event,
  maxPlayerPayment,
  isFromNotification = false,
  notificationId,
}: PaymentAuthorizationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");

  // Fetch user's saved payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["/api/payment-methods"],
    enabled: isOpen, // Only fetch when modal is open
  });

  // Type for payment methods
  interface PaymentMethod {
    id: string;
    type: string;
    card?: {
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    };
    isDefault: boolean;
  }

  const authorizePaymentMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isFromNotification && notificationId
        ? `/api/notifications/${notificationId}/authorize-payment`
        : `/api/events/${event.id}/authorize-payment`;
      const body = { paymentMethodId: selectedPaymentMethod };
      const performAuthorization = () => fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      let response = await performAuthorization();
      if (response.status === 409) {
        const action = await response.json();
        if (!action.requiresAction || !action.clientSecret) {
          throw new Error(action.message || "Payment authorization failed");
        }
        const stripe = await stripePromise;
        if (!stripe) throw new Error("Stripe is unavailable");
        const confirmation = await stripe.confirmCardPayment(action.clientSecret);
        const expectedStatus = isFromNotification ? "succeeded" : "requires_capture";
        if (confirmation.error || confirmation.paymentIntent?.status !== expectedStatus) {
          throw new Error(confirmation.error?.message || "Card authentication was not completed");
        }
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            paymentIntentId: confirmation.paymentIntent.id,
            paymentMethod: isFromNotification ? "finalize" : "wallet",
          }),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Payment authorization failed");
      }

      if (!isFromNotification) {
        await apiRequest("POST", `/api/events/${event.id}/vote`, {
          status: "attending"
        });
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", event.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", event.id, "attendance"] });
      
      toast({
        title: "Authorization Successful",
        description: "Payment authorized and attendance confirmed!",
      });
      
      onSuccess();
      onClose();
    },
    onError: (error: unknown) => {
      console.error("Payment authorization failed:", error);
      const errorMessage = parseStripeError(error);

      toast({
        title: "Authorization Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleAuthorize = () => {
    if (!selectedPaymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method to continue.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    authorizePaymentMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            {isFromNotification ? "Event Payment Required" : "Authorize Payment"}
          </DialogTitle>
          <DialogDescription>
            {isFromNotification 
              ? `Complete your payment of £${maxPlayerPayment.toFixed(2)} to confirm your attendance for this event.`
              : "We'll authorize a payment for this event. This is not a charge - final payment occurs after the event."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Event:</span>
                <span className="text-sm">{event.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{isFromNotification ? "Payment Amount:" : "Authorization Amount:"}</span>
                <Badge variant="secondary" className="font-semibold">
                  £{maxPlayerPayment.toFixed(2)}
                </Badge>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  {isFromNotification ? (
                    <>
                      <div className="font-medium">Payment will be processed immediately</div>
                      <div>This payment confirms your attendance for the event.</div>
                    </>
                  ) : (
                    <>
                      <div className="font-medium">Authorization hold - not a charge</div>
                      <div>We'll authorize this amount. Final charges occur after the event.</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Choose payment method:</Label>
              <RadioGroup 
                value={selectedPaymentMethod} 
                onValueChange={setSelectedPaymentMethod}
                className="space-y-3"
              >
            {/* Saved Payment Methods */}
            {(paymentMethods as PaymentMethod[]).map((method) => (
              <div key={method.id}>
                <Label 
                  htmlFor={method.id} 
                  className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border transition-colors"
                >
                  <RadioGroupItem value={method.id} id={method.id} />
                  <div className="flex items-center space-x-3 flex-1">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">
                          {method.card?.brand} •••• {method.card?.last4}
                        </span>
                        {method.isDefault && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        Expires {String(method.card?.exp_month).padStart(2, '0')}/{method.card?.exp_year}
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            ))}

            {/* Alternative Payment Methods */}
            <div>
              <Label 
                htmlFor="apple-pay" 
                className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border transition-colors"
              >
                <RadioGroupItem value="apple-pay" id="apple-pay" />
                <div className="flex items-center space-x-3 flex-1">
                  <Smartphone className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Apple Pay</span>
                </div>
              </Label>
            </div>

            <div>
              <Label 
                htmlFor="google-pay" 
                className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border transition-colors"
              >
                <RadioGroupItem value="google-pay" id="google-pay" />
                <div className="flex items-center space-x-3 flex-1">
                  <Wallet className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Google Pay</span>
                </div>
              </Label>
            </div>

            <div>
              <Label 
                htmlFor="paypal" 
                className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border transition-colors"
              >
                <RadioGroupItem value="paypal" id="paypal" />
                <div className="flex items-center space-x-3 flex-1">
                  <Wallet className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">PayPal</span>
                </div>
              </Label>
            </div>

            {/* Add New Payment Method Option */}
            <div>
              <Label 
                htmlFor="new-card" 
                className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border transition-colors"
              >
                <RadioGroupItem value="new-card" id="new-card" />
                <div className="flex items-center space-x-3 flex-1">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  <span className="font-medium">Add new card</span>
                </div>
              </Label>
            </div>
              </RadioGroup>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={authorizePaymentMutation.isPending}
            data-testid="button-cancel-authorization"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAuthorize}
            disabled={authorizePaymentMutation.isPending || !selectedPaymentMethod}
            className="min-w-32"
            data-testid="button-authorize-payment"
          >
            {authorizePaymentMutation.isPending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Authorizing...</span>
              </div>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                {isFromNotification ? "Pay now" : "Authorize Payment"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
