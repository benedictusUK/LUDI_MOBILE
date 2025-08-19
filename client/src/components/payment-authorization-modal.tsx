import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface PaymentAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event: any;
  maxPlayerPayment: number;
}

export default function PaymentAuthorizationModal({
  isOpen,
  onClose,
  onSuccess,
  event,
  maxPlayerPayment,
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
      // First create payment authorization hold
      const response = await apiRequest("POST", `/api/events/${event.id}/authorize-payment`, {
        paymentMethodId: selectedPaymentMethod,
        amount: maxPlayerPayment,
      });
      
      // Then update attendance status
      await apiRequest("POST", `/api/events/${event.id}/vote`, {
        status: "attending"
      });
      
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
    onError: (error: any) => {
      console.error("Payment authorization failed:", error);
      let errorMessage = "Failed to authorize payment";
      
      try {
        const errorData = JSON.parse(error.message.split(': ')[1] || '{}');
        if (errorData.details) {
          errorMessage = errorData.details;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        if (error.message && error.message.includes(':')) {
          const parts = error.message.split(': ');
          if (parts.length > 1) {
            errorMessage = parts[1];
          }
        }
      }

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Authorize Payment
          </DialogTitle>
          <DialogDescription>
            We'll authorize a payment for this event. This is not a charge - final payment occurs after the event.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Event:</span>
              <span className="text-sm">{event.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Authorization Amount:</span>
              <Badge variant="secondary" className="font-semibold">
                £{maxPlayerPayment.toFixed(2)}
              </Badge>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <div className="font-medium">Authorization hold - not a charge</div>
                <div>We'll authorize this amount. Final charges occur after the event.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="py-4">
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


        <DialogFooter className="gap-2">
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
                Authorize Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}