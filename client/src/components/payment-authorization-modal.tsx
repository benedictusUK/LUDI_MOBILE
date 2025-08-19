import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { AlertTriangle, CreditCard, Check } from "lucide-react";

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

  const authorizePaymentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/events/${event.id}/vote`, {
        status: "attending"
      });
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
    setIsProcessing(true);
    authorizePaymentMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Payment Authorization Required
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Authorization Hold</p>
                  <p>This event requires payment authorization before you can confirm attendance.</p>
                </div>
              </div>
            </div>

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
                  <p className="font-medium">How it works:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• We'll authorize this amount on your payment method</li>
                    <li>• No charge is made until after the event</li>
                    <li>• The actual charge may be less than the authorized amount</li>
                    <li>• Unused authorization will be released automatically</li>
                  </ul>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={authorizePaymentMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAuthorize}
            disabled={authorizePaymentMutation.isPending}
            className="min-w-32"
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