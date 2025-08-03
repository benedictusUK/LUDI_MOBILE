import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Badge } from "./badge";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Check, X } from "lucide-react";

interface JoinRequestNotificationProps {
  notification: {
    id: string;
    title: string;
    message: string;
    metadata: {
      teamId: string;
      requestUserId: string;
    };
    createdAt: string;
  };
  onAction?: () => void;
}

export function JoinRequestNotification({ notification, onAction }: JoinRequestNotificationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST", 
        `/api/teams/${notification.metadata.teamId}/approve-join/${notification.metadata.requestUserId}`
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Join request approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      onAction?.();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to approve request", 
        variant: "destructive" 
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST", 
        `/api/teams/${notification.metadata.teamId}/reject-join/${notification.metadata.requestUserId}`
      );
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Join request rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      onAction?.();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to reject request", 
        variant: "destructive" 
      });
    },
  });

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-blue-100 rounded-full">
            <UserPlus className="h-4 w-4 text-blue-600" />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{notification.title}</h4>
              <Badge variant="secondary" className="text-xs">
                {new Date(notification.createdAt).toLocaleDateString()}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {notification.message}
            </p>
            
            <div className="flex space-x-2 pt-2">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="flex items-center space-x-1"
              >
                <Check className="h-3 w-3" />
                <span>Approve</span>
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectMutation.mutate()}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className="flex items-center space-x-1 text-red-600 hover:text-red-700"
              >
                <X className="h-3 w-3" />
                <span>Reject</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}