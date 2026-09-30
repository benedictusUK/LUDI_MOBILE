export function useStripe() {
  const unavailable = async () => ({
    error: { message: 'Payments require the iOS or Android app.' },
  });
  return {
    initPaymentSheet: unavailable,
    presentPaymentSheet: unavailable,
    confirmPayment: unavailable,
  };
}