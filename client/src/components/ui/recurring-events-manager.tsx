import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Users, AlertTriangle, Play, Pause, Trash2 } from "lucide-react";

interface RecurringEventsManagerProps {
  eventId: string;
  recurringSeriesId?: string;
  onClose: () => void;
}

export default function RecurringEventsManager({ 
  eventId, 
  recurringSeriesId, 
  onClose 
}: RecurringEventsManagerProps) {
  const { toast } = useToast();
  const [actionDialog, setActionDialog] = useState<{
    type: 'suspend' | 'resume' | 'delete' | 'delete-series';
    eventId?: string;
    show: boolean;
  }>({ type: 'suspend', show: false });

  // Fetch recurring events series
  const { data: seriesEvents = [], isLoading } = useQuery({
    queryKey: ['/api/events/series', recurringSeriesId],
    enabled: !!recurringSeriesId,
  });

  // Suspend series mutation
  const suspendSeriesMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/events/series/${recurringSeriesId}/suspend`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/series', recurringSeriesId] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: "Success",
        description: "Recurring series suspended successfully",
      });
      setActionDialog({ type: 'suspend', show: false });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to suspend recurring series",
        variant: "destructive",
      });
    },
  });

  // Resume series mutation
  const resumeSeriesMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/events/series/${recurringSeriesId}/resume`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/series', recurringSeriesId] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: "Success", 
        description: "Recurring series resumed successfully",
      });
      setActionDialog({ type: 'resume', show: false });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resume recurring series",
        variant: "destructive",
      });
    },
  });

  // Delete single event mutation
  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => 
      apiRequest('DELETE', `/api/events/${eventId}/recurring?deleteSeriesAfter=false`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/series', recurringSeriesId] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
      setActionDialog({ type: 'delete', show: false });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  // Delete series after event mutation
  const deleteSeriesAfterMutation = useMutation({
    mutationFn: (eventId: string) => 
      apiRequest('DELETE', `/api/events/${eventId}/recurring?deleteSeriesAfter=true`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/series', recurringSeriesId] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: "Success",
        description: "Event and future events deleted successfully",
      });
      setActionDialog({ type: 'delete-series', show: false });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete recurring events",
        variant: "destructive",
      });
    },
  });

  const handleAction = () => {
    switch (actionDialog.type) {
      case 'suspend':
        suspendSeriesMutation.mutate();
        break;
      case 'resume':
        resumeSeriesMutation.mutate();
        break;
      case 'delete':
        if (actionDialog.eventId) {
          deleteEventMutation.mutate(actionDialog.eventId);
        }
        break;
      case 'delete-series':
        if (actionDialog.eventId) {
          deleteSeriesAfterMutation.mutate(actionDialog.eventId);
        }
        break;
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Loading Recurring Events...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentDate = new Date().toISOString().split('T')[0];
  const eventsList = (seriesEvents as any[]) || [];
  const futureEvents = eventsList.filter((event: any) => event.startDate >= currentDate);
  const pastEvents = eventsList.filter((event: any) => event.startDate < currentDate);
  const firstEvent = eventsList[0];
  const isSuspended = firstEvent?.isRecurringSuspended;

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Manage Recurring Events
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {eventsList.length} events in this series
            </p>
          </div>
          <div className="flex gap-2">
            {isSuspended ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionDialog({ type: 'resume', show: true })}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Resume Series
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionDialog({ type: 'suspend', show: true })}
                className="flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Suspend Series
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Series Status */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant={isSuspended ? "destructive" : "default"}>
                {isSuspended ? "Suspended" : "Active"}
              </Badge>
              {firstEvent && (
                <span className="text-sm text-gray-600">
                  {firstEvent.recurrenceType?.charAt(0).toUpperCase() + firstEvent.recurrenceType?.slice(1)} recurring
                </span>
              )}
            </div>
          </div>

          {/* Upcoming Events */}
          {futureEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Upcoming Events ({futureEvents.length})</h3>
              <div className="space-y-2">
                {futureEvents.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="font-medium">{event.name}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {event.startDate} at {event.startTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {event.participants ? `Max ${event.participants}` : 'No limit'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {event.isRecurringSuspended && (
                        <Badge variant="secondary" className="text-xs">Suspended</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionDialog({ 
                          type: 'delete', 
                          eventId: event.id, 
                          show: true 
                        })}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActionDialog({ 
                          type: 'delete-series', 
                          eventId: event.id, 
                          show: true 
                        })}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Past Events ({pastEvents.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pastEvents.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-700">{event.name}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {event.startDate} at {event.startTime}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">Completed</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={actionDialog.show} onOpenChange={(show) => 
        setActionDialog(prev => ({ ...prev, show }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog.type === 'suspend' && 
                "This will suspend all future events in this recurring series. You can resume them later."
              }
              {actionDialog.type === 'resume' && 
                "This will resume all suspended events in this recurring series."
              }
              {actionDialog.type === 'delete' && 
                "This will delete only this single event from the recurring series."
              }
              {actionDialog.type === 'delete-series' && 
                "This will delete this event and all future events in the recurring series. This action cannot be undone."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={actionDialog.type.includes('delete') ? 
                "bg-red-600 hover:bg-red-700" : 
                "bg-blue-600 hover:bg-blue-700"
              }
            >
              {actionDialog.type === 'suspend' && 'Suspend Series'}
              {actionDialog.type === 'resume' && 'Resume Series'}
              {actionDialog.type === 'delete' && 'Delete Event'}
              {actionDialog.type === 'delete-series' && 'Delete Series'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}