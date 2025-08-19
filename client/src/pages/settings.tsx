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
import { Settings as SettingsIcon, Bell, CreditCard, User, Smartphone } from "lucide-react";
import { ProfileForm } from "@/components/ui/profile-form";
import PaymentMethodManager from "@/components/payment-method-manager";
import type { NotificationPreferences } from "@shared/schema";

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

  const { data: payments = [] } = useQuery({
    queryKey: ['/api/payments'],
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
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update preferences",
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
    newEvents: true,
    paymentReminders: true,
    eventChanges: true,
    votingOpportunities: false,
    flareGunReminders: false,
    teamInvites: true,
    pushNotificationsIOS: false,
    pushNotificationsAndroid: false,
    ...(preferences as NotificationPreferences || {}),
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
          <TabsList className="grid w-full grid-cols-3">
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
                      checked={currentPreferences.newEvents}
                      onCheckedChange={(checked) => handlePreferenceChange('newEvents', checked)}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="payment-reminders" className="text-base">Payment Reminders</Label>
                      <p className="text-sm text-neutral-500">Receive reminders for upcoming payment deadlines</p>
                    </div>
                    <Switch
                      id="payment-reminders"
                      checked={currentPreferences.paymentReminders}
                      onCheckedChange={(checked) => handlePreferenceChange('paymentReminders', checked)}
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
                      checked={currentPreferences.eventChanges}
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
                      checked={currentPreferences.teamInvites}
                      onCheckedChange={(checked) => handlePreferenceChange('teamInvites', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <div className="space-y-6">
              <PaymentMethodManager />
              
              {/* Payment History */}
              {(payments as any[]).length > 0 ? (
                <Card>
                  <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="h-5 w-5" />
                      <CardTitle className="text-lg">Payment History</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(payments as any[]).map((payment: any) => (
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
                                  Event: {new Date(payment.event.startDate).toLocaleDateString()} at {payment.event.startTime}
                                </p>
                                <p className="text-sm text-neutral-500" data-testid={`payment-created-date-${payment.id}`}>
                                  Payment: {new Date(payment.createdAt).toLocaleDateString()}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium" data-testid={`payment-general-name-${payment.id}`}>
                                  {payment.type === 'event_fee' ? 'Event Payment' : 'Payment'}
                                </p>
                                <p className="text-sm text-neutral-500" data-testid={`payment-created-date-${payment.id}`}>
                                  {new Date(payment.createdAt).toLocaleDateString()}
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
        </Tabs>
      </main>
    </div>
  );
}