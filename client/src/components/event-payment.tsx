import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Initialize Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface EventPaymentProps {
  eventId: string;
  eventName: string;
  eventCost: number;
  userId: string;
  hasVotedAttending: boolean;
  onPaymentSuccess?: () => void;
}

// Payment setup form component
const PaymentSetupForm = ({ 
  eventId, 
  eventName, 
  eventCost, 
  userId, 
  onSuccess 
}: {
  eventId: string;
  eventName: string;
  eventCost: number;
  userId: string;
  onSuccess: () => void;
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
          title: "Payment Setup Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment Method Saved",
          description: "Your payment method has been securely saved for this event.",
        });
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Payment Setup Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <PaymentElement />
        <Button type="submit" disabled={!stripe || isProcessing} className="w-full">
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving Payment Method...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Save Payment Method
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

// Main payment component
export function EventPayment({ 
  eventId, 
  eventName, 
  eventCost, 
  userId, 
  hasVotedAttending,
  onPaymentSuccess 
}: EventPaymentProps) {
  const [paymentStatus, setPaymentStatus] = useState<'none' | 'setup_required' | 'setup_complete' | 'held' | 'captured' | 'cancelled'>('none');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  // Check payment status and initialize if needed
  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!hasVotedAttending) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiRequest('GET', `/api/events/${eventId}/payment-status`);
        const data = await response.json();
        
        setPaymentStatus(data.status || 'none');
        
        // If we need to set up payment method, get the client secret
        if (data.status === 'setup_required' && data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      } catch (error: any) {
        console.error('Failed to check payment status:', error);
        setError('Failed to load payment information');
      } finally {
        setIsLoading(false);
      }
    };

    checkPaymentStatus();
  }, [eventId, hasVotedAttending]);

  // Initialize payment setup when user votes to attend
  const initializePaymentSetup = async () => {
    if (!hasVotedAttending || paymentStatus !== 'none') return;

    setIsLoading(true);
    try {
      const response = await apiRequest('POST', `/api/events/${eventId}/payment-setup`);
      const data = await response.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentStatus('setup_required');
      }
    } catch (error: any) {
      toast({
        title: "Payment Setup Failed",
        description: error.message || "Failed to initialize payment setup",
        variant: "destructive",
      });
      setError(error.message || "Failed to initialize payment setup");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSetupSuccess = () => {
    setPaymentStatus('setup_complete');
    setClientSecret('');
    onPaymentSuccess?.();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading payment information...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Don't show payment component if user hasn't voted to attend
  if (!hasVotedAttending) {
    return null;
  }

  // Payment setup required
  if (paymentStatus === 'setup_required' && clientSecret) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Payment Method Required
          </CardTitle>
          <CardDescription>
            Save a payment method for {eventName}. You'll only be charged £{eventCost.toFixed(2)} after the event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentSetupForm 
              eventId={eventId}
              eventName={eventName}
              eventCost={eventCost}
              userId={userId}
              onSuccess={handlePaymentSetupSuccess}
            />
          </Elements>
        </CardContent>
      </Card>
    );
  }

  // Need to initialize payment setup
  if (paymentStatus === 'none') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Required</CardTitle>
          <CardDescription>
            This event costs £{eventCost.toFixed(2)}. Set up your payment method to secure your spot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={initializePaymentSetup} className="w-full">
            <CreditCard className="w-4 h-4 mr-2" />
            Set Up Payment Method
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Payment method saved successfully
  if (paymentStatus === 'setup_complete') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-green-700">
            <CheckCircle className="w-5 h-5 mr-2" />
            Payment Method Saved
          </CardTitle>
          <CardDescription>
            Your payment method is saved. You'll be charged £{eventCost.toFixed(2)} after the event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Ready for Event
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Payment held (48h before event)
  if (paymentStatus === 'held') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700">
            <AlertCircle className="w-5 h-5 mr-2" />
            Payment Authorized
          </CardTitle>
          <CardDescription>
            £{eventCost.toFixed(2)} has been authorized on your payment method. Final charge will occur after the event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Payment Authorized
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Payment captured (after event)
  if (paymentStatus === 'captured') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-green-700">
            <CheckCircle className="w-5 h-5 mr-2" />
            Payment Complete
          </CardTitle>
          <CardDescription>
            £{eventCost.toFixed(2)} has been charged for {eventName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Payment Complete
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Payment cancelled
  if (paymentStatus === 'cancelled') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-red-700">
            <XCircle className="w-5 h-5 mr-2" />
            Payment Cancelled
          </CardTitle>
          <CardDescription>
            The payment for this event has been cancelled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="destructive">
            Payment Cancelled
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return null;
}