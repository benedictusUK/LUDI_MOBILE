import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

export default function PaymentMethodsScreen() {
  const navigation = useNavigation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { apiRequest } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [addingMethod, setAddingMethod] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [settingDefaultId, setSettingDefaultId] = useState(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/payment-methods');
      if (response.ok) {
        const methods = await response.json();
        setPaymentMethods(methods);
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      Alert.alert('Error', 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      setAddingMethod(true);

      const setupResponse = await apiRequest('/api/payment-methods/setup', {
        method: 'POST',
      });

      if (!setupResponse.ok) {
        throw new Error('Failed to initialize payment setup');
      }

      const { clientSecret } = await setupResponse.json();

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'LUDI Sports',
        setupIntentClientSecret: clientSecret,
        applePay: { merchantCountryCode: 'GB' },
        googlePay: { merchantCountryCode: 'GB', testEnv: true },
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Setup Failed', presentError.message);
        }
        return;
      }

      Alert.alert('Success', 'Payment method added successfully');
      loadPaymentMethods();
    } catch (error) {
      console.error('Add payment method error:', error);
      Alert.alert('Error', error.message || 'Failed to add payment method');
    } finally {
      setAddingMethod(false);
    }
  };

  const handleDeletePaymentMethod = async (methodId) => {
    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(methodId);
              const response = await apiRequest(`/api/payment-methods/${methodId}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                Alert.alert('Success', 'Payment method removed');
                loadPaymentMethods();
              } else {
                const error = await response.json();
                Alert.alert('Error', error.message || 'Failed to delete payment method');
              }
            } catch (error) {
              console.error('Delete payment method error:', error);
              Alert.alert('Error', 'Failed to delete payment method');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (methodId) => {
    try {
      setSettingDefaultId(methodId);
      const response = await apiRequest(`/api/payment-methods/${methodId}/default`, {
        method: 'PUT',
      });

      if (response.ok) {
        Alert.alert('Success', 'Default payment method updated');
        loadPaymentMethods();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to update default');
      }
    } catch (error) {
      console.error('Set default error:', error);
      Alert.alert('Error', 'Failed to update default payment method');
    } finally {
      setSettingDefaultId(null);
    }
  };

  const formatCardBrand = (brand) => {
    return brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card';
  };

  const getCardIcon = (brand) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return 'card';
      case 'mastercard':
        return 'card';
      case 'amex':
        return 'card';
      default:
        return 'card';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Payment Methods</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Payment Methods</Text>
        <TouchableOpacity
          onPress={handleAddPaymentMethod}
          disabled={addingMethod}
          data-testid="button-add-payment-method"
        >
          {addingMethod ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="add" size={24} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Manage your saved payment methods for event payments.
        </Text>

        {paymentMethods.length > 0 ? (
          <View style={styles.methodsList}>
            {paymentMethods.map((method) => (
              <View
                key={method.id}
                style={[styles.methodCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                data-testid={`payment-method-${method.id}`}
              >
                <View style={styles.methodHeader}>
                  <Ionicons name={getCardIcon(method.card?.brand)} size={28} color={colors.textSecondary} />
                  <View style={styles.methodDetails}>
                    <View style={styles.methodTitleRow}>
                      <Text style={[styles.methodTitle, { color: colors.text }]}>
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
                </View>

                <View style={styles.methodActions}>
                  {!method.isDefault && (
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: colors.border }]}
                      onPress={() => handleSetDefault(method.id)}
                      disabled={settingDefaultId === method.id}
                    >
                      {settingDefaultId === method.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                          Set Default
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.deleteButton, { borderColor: '#ef4444' }]}
                    onPress={() => handleDeletePaymentMethod(method.id)}
                    disabled={deletingId === method.id}
                    data-testid={`button-delete-${method.id}`}
                  >
                    {deletingId === method.id ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Ionicons name="card-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No payment methods</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Add a payment method to participate in paid events.
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddPaymentMethod}
              disabled={addingMethod}
            >
              {addingMethod ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addButtonText}>Add Payment Method</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoHeader}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>Secure Payments</Text>
          </View>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            All payment details are securely processed and stored by Stripe. LUDI never stores your card numbers or CVV.
          </Text>
          <View style={styles.infoDivider} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            When you sign up for paid events, we'll authorize (hold) the payment amount. Actual charges occur after events.
          </Text>
        </View>
      </ScrollView>
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
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  methodsList: {
    gap: 12,
  },
  methodCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodDetails: {
    flex: 1,
    marginLeft: 12,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  methodExpiry: {
    fontSize: 13,
    marginTop: 2,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  methodActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    marginVertical: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
});
