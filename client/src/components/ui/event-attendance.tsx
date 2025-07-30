import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, Users } from "lucide-react";
import type { EventAttendance, User } from "@shared/schema";

interface EventAttendanceProps {
  eventId: string;
  eventName: string;
  startDate: string;
  cost?: string;
}

export function EventAttendance({ eventId, eventName, startDate, cost }: EventAttendanceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['/api/events', eventId, 'attendance'],
  });

  const { data: userAttendance } = useQuery({
    queryKey: ['/api/events', eventId, 'user-attendance'],
    queryFn: () => apiRequest("GET", `/api/events/${eventId}/attendance`).then(res => res.json()),
  });

  const recordAttendanceMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("POST", `/api/events/${eventId}/attendance`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId, 'user-attendance'] });
      toast({
        title: "Attendance Updated",
        description: "Your attendance has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record attendance",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'attending': return 'default';
      case 'not_attending': return 'destructive';
      case 'voted_late': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'attending': return <Check className="h-4 w-4" />;
      case 'not_attending': return <X className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Event Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const attendingCount = attendance.filter((a: any) => a.status === 'attending').length;
  const notAttendingCount = attendance.filter((a: any) => a.status === 'not_attending').length;
  const pendingCount = attendance.filter((a: any) => a.status === 'pending').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Event Attendance
        </CardTitle>
        <CardDescription>
          {eventName} - {new Date(startDate).toLocaleDateString()}
          {cost && ` • Cost: £${cost}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Vote buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => recordAttendanceMutation.mutate('attending')}
            disabled={recordAttendanceMutation.isPending}
            variant={userAttendance?.status === 'attending' ? 'default' : 'outline'}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            I'm Going
          </Button>
          <Button
            onClick={() => recordAttendanceMutation.mutate('not_attending')}
            disabled={recordAttendanceMutation.isPending}
            variant={userAttendance?.status === 'not_attending' ? 'destructive' : 'outline'}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Can't Go
          </Button>
        </div>

        {/* Attendance summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">{attendingCount}</div>
            <div className="text-xs text-green-600 dark:text-green-400">Going</div>
          </div>
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
            <div className="text-lg font-bold text-red-600 dark:text-red-400">{notAttendingCount}</div>
            <div className="text-xs text-red-600 dark:text-red-400">Not Going</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="text-lg font-bold text-gray-600 dark:text-gray-400">{pendingCount}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Pending</div>
          </div>
        </div>

        {/* Attendee list */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Responses ({attendance.length})</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {attendance.map((attendee: any) => (
              <div key={attendee.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                    {attendee.user.firstName?.[0] || attendee.user.email?.[0] || '?'}
                  </div>
                  <span className="text-sm">
                    {attendee.user.firstName} {attendee.user.lastName} 
                  </span>
                </div>
                <Badge variant={getStatusBadgeVariant(attendee.status)} className="text-xs">
                  {getStatusIcon(attendee.status)}
                  <span className="ml-1">
                    {attendee.status === 'attending' ? 'Going' : 
                     attendee.status === 'not_attending' ? 'Not Going' : 'Pending'}
                  </span>
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}