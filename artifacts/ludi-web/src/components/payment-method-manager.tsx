import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, CreditCard, CheckCircle, AlertCircle, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Initialize Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

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

// Payment method setup form component
const PaymentMethodSetupForm = ({ 
  onSuccess, 
  onCancel 
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Confirm the setup
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Setup Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Method Added",
          description: "Your payment method has been saved successfully.",
        });
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <div className="flex space-x-3">
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1"
          data-testid="button-save-payment-method"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Save Payment Method
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default function PaymentMethodManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingMethod, setIsAddingMethod] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user's saved payment methods
  const { data: paymentMethods = [], isLoading: methodsLoading } = useQuery({
    queryKey: ["/api/payment-methods"],
    staleTime: 30000,
  });

  // Setup new payment method
  const setupPaymentMethodMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/payment-methods/setup');
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setIsAddingMethod(true);
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to initialize payment method setup",
        variant: "destructive",
      });
    },
  });

  // Delete payment method
  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await apiRequest('DELETE', `/api/payment-methods/${paymentMethodId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({
        title: "Payment Method Removed",
        description: "Your payment method has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to remove payment method",
        variant: "destructive",
      });
    },
  });

  // Set default payment method
  const setDefaultMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const response = await apiRequest('PUT', `/api/payment-methods/${paymentMethodId}/default`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({
        title: "Default Updated",
        description: "Default payment method has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update default payment method",
        variant: "destructive",
      });
    },
  });

  const handleAddPaymentMethod = () => {
    setupPaymentMethodMutation.mutate();
  };

  const handlePaymentMethodSetupSuccess = () => {
    setIsAddingMethod(false);
    setClientSecret(null);
    queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
  };

  const handleCancelSetup = () => {
    setIsAddingMethod(false);
    setClientSecret(null);
  };

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  if (methodsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Payment Methods</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Payment Methods</span>
            </div>
            <Button
              onClick={handleAddPaymentMethod}
              disabled={setupPaymentMethodMutation.isPending}
              size="sm"
              data-testid="button-add-payment-method"
            >
              {setupPaymentMethodMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Method
            </Button>
          </CardTitle>
          <CardDescription>
            Manage your saved payment methods for event payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(paymentMethods as PaymentMethod[]).length > 0 ? (
            <div className="space-y-3">
              {(paymentMethods as PaymentMethod[]).map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`payment-method-${method.id}`}
                >
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="font-medium">
                        {formatCardBrand(method.card?.brand || method.type)} •••• {method.card?.last4}
                      </div>
                      <div className="text-sm text-gray-500">
                        Expires {method.card?.exp_month?.toString().padStart(2, '0')}/{method.card?.exp_year}
                      </div>
                    </div>
                    {method.isDefault && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMethodMutation.mutate(method.id)}
                        disabled={setDefaultMethodMutation.isPending}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePaymentMethodMutation.mutate(method.id)}
                      disabled={deletePaymentMethodMutation.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payment methods</h3>
              <p className="text-gray-500 mb-4">
                Add a payment method to participate in paid events.
              </p>
            </div>
          )}

          {/* Payment Method Setup Dialog */}
          <Dialog open={isAddingMethod} onOpenChange={setIsAddingMethod}>
            <DialogContent className="sm:max-w-md max-h-[95vh] flex flex-col">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add Payment Method</DialogTitle>
                <DialogDescription>
                  Your payment details are securely processed and stored by Stripe. We never store your card information on our servers.
                </DialogDescription>
              </DialogHeader>
              {clientSecret && (
                <div className="flex-1 overflow-y-auto py-4">
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentMethodSetupForm
                      onSuccess={handlePaymentMethodSetupSuccess}
                      onCancel={handleCancelSetup}
                    />
                  </Elements>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>Important Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Secure Storage:</strong> All payment details are securely processed and stored by Stripe, a PCI DSS compliant payment processor. LUDI never stores your card numbers, CVV, or other sensitive payment information on our servers.</p>
                <p><strong>Payment Authorization:</strong> When you sign up for paid events, we'll authorize (hold) the payment amount on your card but won't charge it immediately.</p>
                <p><strong>Final Charges:</strong> Actual charges occur after events based on attendance and any additional costs incurred.</p>
                <p><strong>Industry Standard Security:</strong> Stripe uses bank-level security and encryption to protect your payment information.</p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}