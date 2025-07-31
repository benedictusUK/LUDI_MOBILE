import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { ActivityIcon, ClockIcon, UserIcon } from "lucide-react";
import type { ActivityLog, User } from "@shared/schema";

interface AuditModalProps {
  eventId: string;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditModal({ eventId, eventName, isOpen, onClose }: AuditModalProps) {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['/api/events', eventId, 'audit'],
    enabled: isOpen,
  });

  const formatAction = (action: string) => {
    switch (action) {
      case 'voted_attending':
        return { text: 'Voted Attending', color: 'bg-green-100 text-green-800' };
      case 'voted_not_attending':
        return { text: 'Voted Not Attending', color: 'bg-red-100 text-red-800' };
      case 'changed_vote':
        return { text: 'Changed Vote', color: 'bg-blue-100 text-blue-800' };
      case 'unvoted':
        return { text: 'Removed Vote', color: 'bg-gray-100 text-gray-800' };
      default:
        return { text: action, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActivityIcon className="h-5 w-5" />
            Activity Audit - {eventName}
          </DialogTitle>
          <DialogDescription>
            Activity log showing all voting actions and changes for this event
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No activity recorded for this event yet
            </div>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log: ActivityLog & { user: User }) => {
                const action = formatAction(log.action);
                const dateTime = formatDateTime(log.timestamp || '');
                
                return (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="bg-primary p-2 rounded-lg">
                          <UserIcon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-neutral-900">
                              {log.user.firstName} {log.user.lastName}
                            </span>
                            <Badge className={action.color}>
                              {action.text}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-neutral-600 space-y-1">
                            <div className="flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              {dateTime.date} at {dateTime.time}
                            </div>
                            
                            {log.previousStatus && log.newStatus && (
                              <div className="text-xs text-neutral-500">
                                Changed from "{log.previousStatus}" to "{log.newStatus}"
                              </div>
                            )}
                            
                            {log.ipAddress && (
                              <div className="text-xs text-neutral-400">
                                IP: {log.ipAddress}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}