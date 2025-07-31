import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/ui/nav";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Bell, CreditCard, User, Smartphone } from "lucide-react";
import type { NotificationPreferences } from "@shared/schema";

export default function Settings() {
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
      const response = await apiRequest("PUT", "/api/notification-preferences", newPreferences);
      return response.json();
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
      ...preferences,
      [key]: value,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  const defaultPreferences = {
    newEvents: true,
    paymentReminders: true,
    eventChanges: true,
    votingOpportunities: false,
    flareGunReminders: false,
    teamInvites: true,
    pushNotificationsIOS: false,
    pushNotificationsAndroid: false,
    ...preferences,
  };

  const pendingPayments = payments.filter((p: any) => p.status === 'pending').length;
  const overduePayments = payments.filter((p: any) => p.status === 'overdue').length;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your account details and basic information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Name</Label>
              <div className="mt-1 text-sm">
                {user?.firstName} {user?.lastName}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Email</Label>
              <div className="mt-1 text-sm">{user?.email}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Overview
          </CardTitle>
          <CardDescription>
            Your payment status and history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {payments.length}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Total Payments</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {pendingPayments}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Pending</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {overduePayments}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">Overdue</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose what notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Notifications */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Email Notifications</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="new-events">New Events</Label>
                  <div className="text-sm text-gray-500">Get notified when new events are created</div>
                </div>
                <Switch
                  id="new-events"
                  checked={defaultPreferences.newEvents}
                  onCheckedChange={(checked) => handlePreferenceChange('newEvents', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="payment-reminders">Payment Reminders</Label>
                  <div className="text-sm text-gray-500">Reminders for outstanding payments</div>
                </div>
                <Switch
                  id="payment-reminders"
                  checked={defaultPreferences.paymentReminders}
                  onCheckedChange={(checked) => handlePreferenceChange('paymentReminders', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="event-changes">Event Changes</Label>
                  <div className="text-sm text-gray-500">Updates when event details change</div>
                </div>
                <Switch
                  id="event-changes"
                  checked={defaultPreferences.eventChanges}
                  onCheckedChange={(checked) => handlePreferenceChange('eventChanges', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voting-opportunities">Voting Opportunities</Label>
                  <div className="text-sm text-gray-500">Notifications when you can vote on events</div>
                </div>
                <Switch
                  id="voting-opportunities"
                  checked={defaultPreferences.votingOpportunities}
                  onCheckedChange={(checked) => handlePreferenceChange('votingOpportunities', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="flare-gun-reminders">Flare Gun Reminders</Label>
                  <div className="text-sm text-gray-500">Urgent notifications that require immediate attention</div>
                </div>
                <Switch
                  id="flare-gun-reminders"
                  checked={defaultPreferences.flareGunReminders}
                  onCheckedChange={(checked) => handlePreferenceChange('flareGunReminders', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="team-invites">Team Invites</Label>
                  <div className="text-sm text-gray-500">Invitations to join teams</div>
                </div>
                <Switch
                  id="team-invites"
                  checked={defaultPreferences.teamInvites}
                  onCheckedChange={(checked) => handlePreferenceChange('teamInvites', checked)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Push Notifications */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Push Notifications
            </h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-ios">iOS Push Notifications</Label>
                  <div className="text-sm text-gray-500">Receive notifications on your iPhone/iPad</div>
                </div>
                <Switch
                  id="push-ios"
                  checked={defaultPreferences.pushNotificationsIOS}
                  onCheckedChange={(checked) => handlePreferenceChange('pushNotificationsIOS', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-android">Android Push Notifications</Label>
                  <div className="text-sm text-gray-500">Receive notifications on your Android device</div>
                </div>
                <Switch
                  id="push-android"
                  checked={defaultPreferences.pushNotificationsAndroid}
                  onCheckedChange={(checked) => handlePreferenceChange('pushNotificationsAndroid', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}