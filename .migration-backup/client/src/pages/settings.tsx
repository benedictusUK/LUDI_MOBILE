import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import Navigation from "@/components/ui/nav";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Bell, CreditCard, User } from "lucide-react";
import { ProfileForm } from "@/components/ui/profile-form";
import PaymentMethodManager from "@/components/payment-method-manager";
import type { NotificationPreferences, PlatformCharge, Event, Payment } from "@shared/schema";

export default function Settings() {
  useScrollToTop();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['/api/notification-preferences'],
  });

  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
  });

  const { data: payments = [] } = useQuery<(Payment & { event?: Event })[]>({
    queryKey: ['/api/payments'],
  });

  const { data: incomingPayments = [] } = useQuery<(Payment & { event?: Event })[]>({
    queryKey: ['/api/payments/incoming'],
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['/api/payment-methods'],
  });

  const { data: platformCharges = [] } = useQuery<PlatformCharge[]>({
    queryKey: ['/api/platform-charges'],
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<NotificationPreferences>) => {
      const response = await apiRequest("PUT", "/api/notification-preferences", {
        body: JSON.stringify(newPreferences),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences'] });
      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to update preferences";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    updatePreferencesMutation.mutate({
      ...(preferences as NotificationPreferences || {}),
      [key]: value,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const currentPreferences: NotificationPreferences = {
    ...(preferences as NotificationPreferences || {
      newEvents: true,
      paymentReminders: true,
      eventChanges: true,
      votingOpportunities: false,
      flareGunReminders: false,
      teamInvites: true,
      pushNotificationsIOS: false,
      pushNotificationsAndroid: false,
    }),
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Settings</h1>
          <p className="text-neutral-500">Manage your account preferences and settings</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span>Payments</span>
            </TabsTrigger>
            <TabsTrigger value="platform" className="flex items-center space-x-2">
              <SettingsIcon className="h-4 w-4" />
              <span>Platform</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileForm user={user} />
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <CardTitle className="text-lg">Notification Preferences</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="new-events" className="text-base">New Events</Label>
                      <p className="text-sm text-neutral-500">Get notified when new events are created in your teams</p>
                    </div>
                    <Switch
                      id="new-events"
                      checked={currentPreferences.newEvents ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange('newEvents', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="payment-reminders" className="text-base">Payment Reminders</Label>
                      <p className="text-sm text-neutral-500">Payment notifications are always enabled for security</p>
                    </div>
                    <Switch
                      id="payment-reminders"
                      checked={true}
                      disabled={true}
                      className="opacity-50"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="event-changes" className="text-base">Event Changes</Label>
                      <p className="text-sm text-neutral-500">Get updates when event details are modified</p>
                    </div>
                    <Switch
                      id="event-changes"
                      checked={currentPreferences.eventChanges ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange('eventChanges', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="team-invites" className="text-base">Team Invites</Label>
                      <p className="text-sm text-neutral-500">Receive notifications for team invitations</p>
                    </div>
                    <Switch
                      id="team-invites"
                      checked={currentPreferences.teamInvites ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange('teamInvites', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Tabs defaultValue="out" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="out">Payments Out</TabsTrigger>
                <TabsTrigger value="in">Payments In</TabsTrigger>
              </TabsList>

              <TabsContent value="out">
                <div className="space-y-6">
                  <PaymentMethodManager />

                  {payments.length > 0 ? (
                    <Card>
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-5 w-5" />
                          <CardTitle className="text-lg">Payment History</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                              data-testid={`payment-history-item-${payment.id}`}
                            >
                              <div className="space-y-1 flex-1">
                                {payment.event ? (
                                  <>
                                    <p className="font-medium" data-testid={`payment-event-name-${payment.id}`}>
                                      {payment.event.name}
                                    </p>
                                    <p className="text-sm text-neutral-600" data-testid={`payment-event-date-${payment.id}`}>
                                      Event: {payment.event.startDate ? new Date(payment.event.startDate).toLocaleDateString() : ''} at {payment.event.startTime}
                                    </p>
                                    <p className="text-sm text-neutral-500" data-testid={`payment-created-date-${payment.id}`}>
                                      Payment: {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : ''}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="font-medium" data-testid={`payment-general-name-${payment.id}`}>
                                      {payment.type === 'event_fee' ? 'Event Payment' : 'Payment'}
                                    </p>
                                    <p className="text-sm text-neutral-500" data-testid={`payment-created-date-${payment.id}`}>
                                      {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : ''}
                                    </p>
                                  </>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-medium" data-testid={`payment-amount-${payment.id}`}>
                                  £{parseFloat(payment.amount).toFixed(2)}
                                </p>
                                <p className={`text-sm capitalize ${
                                  payment.status === 'completed' || payment.status === 'captured' || payment.status === 'paid'
                                    ? 'text-green-600'
                                    : payment.status === 'failed' || payment.status === 'cancelled'
                                    ? 'text-red-600'
                                    : 'text-yellow-600'
                                }`} data-testid={`payment-status-${payment.id}`}>
                                  {payment.status}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <CreditCard className="h-5 w-5" />
                          <span>Payment History</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8">
                          <CreditCard className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-neutral-900 mb-2">No payments yet</h3>
                          <p className="text-neutral-500">Your payment history will appear here once you make payments for events.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="in">
                <div className="space-y-6">
                  {incomingPayments.length > 0 ? (
                    <Card>
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-5 w-5" />
                          <CardTitle className="text-lg">Incoming Payments</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {incomingPayments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="space-y-1 flex-1">
                                {payment.event ? (
                                  <>
                                    <p className="font-medium">{payment.event.name}</p>
                                    <p className="text-sm text-neutral-600">
                                      Event: {payment.event.startDate ? new Date(payment.event.startDate).toLocaleDateString() : ''} at {payment.event.startTime}
                                    </p>
                                    <p className="text-sm text-neutral-500">
                                      Recorded: {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : ''}
                                    </p>
                                  </>
                                ) : (
                                  <p className="font-medium">Payment</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-medium">£{parseFloat(payment.amount).toFixed(2)}</p>
                                <p className={`text-sm capitalize ${
                                  payment.status === 'paid'
                                    ? 'text-green-600'
                                    : payment.status === 'transferred'
                                    ? 'text-blue-600'
                                    : 'text-yellow-600'
                                }`}>
                                  {payment.status}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <CreditCard className="h-5 w-5" />
                          <span>Incoming Payments</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center py-8">
                          <CreditCard className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-neutral-900 mb-2">No incoming payments</h3>
                          <p className="text-neutral-500">Payments you receive will appear here once events are settled.</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="platform">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SettingsIcon className="h-5 w-5" />
                  <span>Platform Charges</span>
                </CardTitle>
                <CardDescription>
                  View current platform charges for event payments (read-only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {platformCharges.map((charge) => (
                    <div
                      key={charge.id}
                      className="p-4 border rounded-lg bg-gray-50"
                      data-testid={`platform-charge-${charge.name}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">{charge.name}</h3>
                        <div className="text-sm text-gray-500 capitalize">
                          {charge.type} charge
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4">
                        {charge.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Label className="text-sm font-medium text-gray-700">
                            Current Value
                          </Label>
                          <div className="mt-1 text-lg font-semibold text-gray-900">
                            {charge.type === 'percentage' 
                              ? `${(parseFloat(charge.value) * 100).toFixed(1)}%`
                              : `£${parseFloat(charge.value).toFixed(2)}`
                            }
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {charge.type === 'percentage' ? `Raw value: ${charge.value}` : `Raw value: £${charge.value}`}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-700">Type</div>
                          <div className="text-sm text-gray-600 capitalize mt-1">
                            {charge.type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">How Platform Charges Work</h4>
                    <div className="text-sm text-blue-800 space-y-2">
                      <p>• <strong>Stripe fees</strong> cover payment processing costs</p>
                      <p>• <strong>LUDI platform fee</strong> supports platform maintenance</p>
                      <p>• These charges are automatically added to the base event cost</p>
                      <p>• Players see the total amount when authorizing payment</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}