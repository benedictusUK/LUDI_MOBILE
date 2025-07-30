import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/ui/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Notifications() {
  const { toast } = useToast();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["/api/notifications"],
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/read-all", {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to mark notifications as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to mark notification as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "event":
        return "fas fa-calendar";
      case "team":
        return "fas fa-users";
      case "payment":
        return "fas fa-credit-card";
      default:
        return "fas fa-bell";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "event":
        return "bg-primary";
      case "team":
        return "bg-secondary";
      case "payment":
        return "bg-yellow-500";
      default:
        return "bg-neutral-500";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Notification Center</h1>
          <p className="text-neutral-500">Stay updated with your sports events and team activities</p>
        </div>

        {/* Notification Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-events">New events in my teams</Label>
                  <Switch id="new-events" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="payment-reminders">Payment reminders</Label>
                  <Switch id="payment-reminders" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="event-changes">Event changes & updates</Label>
                  <Switch id="event-changes" defaultChecked />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="voting">Voting opportunities</Label>
                  <Switch id="voting" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="flare-gun">Flare gun reminders</Label>
                  <Switch id="flare-gun" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="team-invites">Team invitations</Label>
                  <Switch id="team-invites" defaultChecked />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Notifications</CardTitle>
            <Button 
              variant="link" 
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              Mark all as read
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-bell text-neutral-300 text-6xl mb-4"></i>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-2">No notifications</h3>
                  <p className="text-neutral-500">You're all caught up!</p>
                </div>
              ) : (
                notifications.map((notification: any) => (
                  <div 
                    key={notification.id} 
                    className={`flex items-start space-x-4 p-4 border border-gray-100 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer ${
                      !notification.isRead ? "bg-blue-50 border-blue-200" : ""
                    }`}
                    onClick={() => !notification.isRead && markAsReadMutation.mutate(notification.id)}
                  >
                    <div className="flex-shrink-0">
                      <div className={`${getNotificationColor(notification.type)} p-2 rounded-lg`}>
                        <i className={`${getNotificationIcon(notification.type)} text-white text-sm`}></i>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-medium ${notification.isRead ? "text-neutral-500" : "text-neutral-900"}`}>
                        {notification.title}
                      </h4>
                      <p className={`text-sm ${notification.isRead ? "text-neutral-400" : "text-neutral-500"}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div className="flex-shrink-0">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
