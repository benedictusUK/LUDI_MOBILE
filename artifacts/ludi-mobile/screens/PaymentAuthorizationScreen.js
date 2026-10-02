import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '../lib/stripe';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function PaymentAuthorizationScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { initPaymentSheet, presentPaymentSheet, handleNextAction } = useStripe();
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();
  
  const { eventId, eventName, maxPlayerPayment, isFromNotification, notificationId } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [ready, setReady] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [event, setEvent] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(false);
  const policy = quote?.paymentPolicy && quote.paymentPolicy !== 'none' ? quote.paymentPolicy : 'flexible_post_event';
  const isFixed = !!quote?.isRecovery || policy === 'fixed_immediate' || policy === 'fixed_threshold';
  const displayAmount = quote?.amountMinor != null ? quote.amountMinor / 100 : parseFloat(maxPlayerPayment || 0);
  const blocked = quote ? quote.canPay === false : false;

  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    try {
      setLoading(true);

      setQuoteError(false);
      const [eventRes, methodsRes, quoteRes] = await Promise.all([
        apiRequest(`/api/events/${eventId}`),
        apiRequest('/api/payment-methods'),
        apiRequest(`/api/events/${eventId}/payment-policy${isFromNotification && notificationId ? `?notificationId=${encodeURIComponent(notificationId)}` : ''}`),
      ]);

      if (quoteRes.ok) {
        setQuote(await quoteRes.json());
      } else {
        setQuoteError(true);
      }

      if (eventRes.ok) {
        const eventData = await eventRes.json();
        setEvent(eventData);
      }

      if (methodsRes.ok) {
        const methods = await methodsRes.json();
        setPaymentMethods(methods);
        const defaultMethod = methods.find(m => m.isDefault);
        if (defaultMethod) {
          setSelectedMethod(defaultMethod.id);
        } else if (methods.length > 0) {
          setSelectedMethod(methods[0].id);
        }
      }

      setReady(true);
    } catch (error) {
      console.error('Failed to load payment data:', error);
      Alert.alert('Error', 'Failed to load payment information');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizePayment = async () => {
    if (!selectedMethod) {
      Alert.alert('Payment Method Required', 'Please select a payment method to continue.');
      return;
    }

    try {
      setProcessing(true);

      let endpoint, body;
      
      if (isFromNotification && notificationId) {
        endpoint = `/api/notifications/${notificationId}/authorize-payment`;
        body = { paymentMethodId: selectedMethod };
      } else {
        endpoint = `/api/events/${eventId}/authorize-payment`;
        body = { paymentMethodId: selectedMethod };
      }

      const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      let finalResponse = response;
      if (response.status === 409) {
        const action = await response.json();
        if (!action.requiresAction || !action.clientSecret) {
          throw new Error(action.message || 'Payment authorization failed');
        }
        const { error, paymentIntent } = await handleNextAction(action.clientSecret);
        if (error || !['Succeeded', 'RequiresCapture'].includes(paymentIntent?.status)) {
          throw new Error(error?.message || 'Card authentication was not completed');
        }
        finalResponse = await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            paymentMethod: isFromNotification ? 'finalize' : 'wallet',
          }),
        });
      }

      if (finalResponse.ok) {
        const data = await finalResponse.json();
        
        if (!isFromNotification) {
          const voteResponse = await apiRequest(`/api/events/${eventId}/vote`, {
            method: 'POST',
            body: JSON.stringify({ status: 'attending' }),
          });
          
          if (!voteResponse.ok) {
            console.warn('Vote failed after authorization');
          }
        }

        Alert.alert(
          'Authorisation Successful',
          isFromNotification 
            ? 'Payment processed and attendance confirmed!' 
            : 'Payment authorised and attendance confirmed!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        const error = await finalResponse.json();
        Alert.alert('Authorisation Failed', error.message || 'Failed to authorise payment');
      }
    } catch (error) {
      console.error('Authorisation error:', error);
      Alert.alert('Error', 'Failed to process authorisation');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayWithGooglePay = async () => {
    try {
      setProcessing(true);

      const response = await apiRequest('/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          ...(isFromNotification && notificationId ? { notificationId } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret, paymentIntentId } = await response.json();

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'LUDI Sports',
        paymentIntentClientSecret: clientSecret,
        googlePay: { merchantCountryCode: 'GB', testEnv: true },
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', paymentError.message);
        }
        return;
      }

      // Register the payment authorization with the backend after successful wallet payment
      // Use the authorize-payment endpoint to store the payment record
      const authorizeResponse = await apiRequest(`/api/events/${eventId}/authorize-payment`, {
        method: 'POST',
        body: JSON.stringify({
          paymentIntentId,
          paymentMethod: 'wallet',
        }),
      });

      if (!authorizeResponse.ok) {
        const err = await authorizeResponse.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to register wallet payment. Please retry.');
      }

      // Update attendance status
      const voteResponse = await apiRequest(`/api/events/${eventId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ status: 'attending' }),
      });

      if (!voteResponse.ok) {
        console.warn('Vote failed after wallet payment');
      }

      Alert.alert(
        'Payment Successful',
        'Your payment has been processed and attendance confirmed!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Google Pay error:', error);
      Alert.alert('Error', error.message || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const formatCardBrand = (brand) => {
    return brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading payment options...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} data-testid="button-back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isFromNotification ? 'Complete Payment' : 'Authorise Payment'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Event</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{eventName || event?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {isFromNotification || isFixed ? 'Payment Amount (GBP)' : 'Authorisation Cap (GBP)'}
            </Text>
            <View style={[styles.amountBadge, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
              <Text style={[styles.amountText, { color: isDark ? '#60a5fa' : '#1d4ed8' }]}>
                £{displayAmount.toFixed(2)} GBP
              </Text>
            </View>
          </View>
        </View>

        {quoteError && (
          <TouchableOpacity onPress={loadPaymentData}>
            <Text style={{ color: colors.error || '#ef4444', marginBottom: 12 }}>Could not load the payment amount. Tap to retry.</Text>
          </TouchableOpacity>
        )}
        {blocked && (
          <Text style={{ color: '#b45309', marginBottom: 12 }}>{quote?.reason || 'Payment is not available right now.'}</Text>
        )}

        <View style={[styles.infoBox, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe', borderColor: isDark ? '#3b82f6' : '#93c5fd' }]}>
          <Ionicons name="checkmark-circle" size={20} color={isDark ? '#60a5fa' : '#2563eb'} />
          <View style={styles.infoBoxContent}>
            <Text style={[styles.infoBoxTitle, { color: isDark ? '#60a5fa' : '#1d4ed8' }]}>
              {isFromNotification ? 'Payment will be processed immediately' : isFixed ? 'Charged upfront' : 'Authorisation hold - not a charge'}
            </Text>
            <Text style={[styles.infoBoxText, { color: isDark ? '#93c5fd' : '#3b82f6' }]}>
              {isFromNotification 
                ? 'This payment confirms your attendance for the event.'
                : isFixed
                  ? (policy === 'fixed_threshold'
                    ? `Fees are included in the price. If fewer than ${quote?.minimumPaidParticipants ?? 'the minimum'} people have paid by the deadline, you are refunded in full.`
                    : 'Fees are included in the price. You can withdraw for a full refund before the deadline.')
                  : "We'll authorise up to this cap. You are charged the actual cost after the event."}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose payment method</Text>

        {paymentMethods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.paymentMethodItem,
              { 
                backgroundColor: colors.card,
                borderColor: selectedMethod === method.id ? colors.primary : colors.border,
                borderWidth: selectedMethod === method.id ? 2 : 1,
              }
            ]}
            onPress={() => setSelectedMethod(method.id)}
            data-testid={`payment-method-${method.id}`}
          >
            <View style={styles.radioOuter}>
              {selectedMethod === method.id && (
                <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
              )}
            </View>
            <Ionicons name="card" size={24} color={colors.textSecondary} />
            <View style={styles.methodInfo}>
              <View style={styles.methodRow}>
                <Text style={[styles.methodName, { color: colors.text }]}>
                  {formatCardBrand(method.card?.brand)} •••• {method.card?.last4}
                </Text>
                {method.isDefault && (
                  <View style={[styles.defaultBadge, { backgroundColor: isDark ? '#064e3b' : '#d1fae5' }]}>
                    <Text style={[styles.defaultBadgeText, { color: isDark ? '#10b981' : '#047857' }]}>
                      Default
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.methodExpiry, { color: colors.textSecondary }]}>
                Expires {String(method.card?.exp_month).padStart(2, '0')}/{method.card?.exp_year}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {Platform.OS === 'android' && <TouchableOpacity
          style={[
            styles.paymentMethodItem,
            { 
              backgroundColor: colors.card,
              borderColor: selectedMethod === 'google-pay' ? colors.primary : colors.border,
              borderWidth: selectedMethod === 'google-pay' ? 2 : 1,
            }
          ]}
          onPress={() => setSelectedMethod('google-pay')}
          data-testid="payment-method-google-pay"
        >
          <View style={styles.radioOuter}>
            {selectedMethod === 'google-pay' && (
              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
            )}
          </View>
          <Ionicons name="wallet" size={24} color={colors.textSecondary} />
          <Text style={[styles.methodName, { color: colors.text }]}>Google Pay</Text>
        </TouchableOpacity>}

        {paymentMethods.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Ionicons name="card-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved cards</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {Platform.OS === 'android'
                ? 'Use Google Pay or add a card in Settings.'
                : 'Add a card in Settings to continue.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
          disabled={processing}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.authorizeButton,
            { backgroundColor: colors.primary },
            (!selectedMethod || processing) && styles.disabledButton
          ]}
          onPress={selectedMethod === 'google-pay'
            ? handlePayWithGooglePay
            : handleAuthorizePayment}
          disabled={!selectedMethod || processing || blocked || quoteError}
          data-testid="button-authorize-payment"
        >
          {processing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="card" size={20} color="#fff" />
              <Text style={styles.authorizeButtonText}>
                {isFromNotification ? 'Pay Now' : 'Authorise Payment'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  amountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
  },
  infoBoxContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoBoxText: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  methodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodName: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 12,
  },
  methodExpiry: {
    fontSize: 13,
    marginTop: 2,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  authorizeButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  authorizeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
