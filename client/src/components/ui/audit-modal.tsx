import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityIcon, ClockIcon, UserIcon, CreditCardIcon, DollarSignIcon } from "lucide-react";
import type { ActivityLog, User } from "@shared/schema";

interface AuditModalProps {
  eventId: string;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface AuditData {
  event: {
    id: string;
    name: string;
    paymentCollectionInitiated: boolean;
    paymentCollectionInitiatedAt: string | null;
    paymentCollectionInitiatedBy: string | null;
    paymentStatus: string;
  };
  votingAudit: Array<ActivityLog & { user: User }>;
  paymentsAudit: {
    eventPayments: any[];
    transactions: any[];
  };
}

export default function AuditModal({ eventId, eventName, isOpen, onClose }: AuditModalProps) {
  const [activeTab, setActiveTab] = useState("voting");
  
  const { data: auditData, isLoading } = useQuery<AuditData>({
    queryKey: ['/api/events', eventId, 'audit'],
    enabled: isOpen,
  });

  const auditLogs = auditData?.votingAudit || [];
  const paymentRecords = auditData?.paymentsAudit?.eventPayments || [];
  const transactions = auditData?.paymentsAudit?.transactions || [];

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

  const formatDateTime = (timestamp: string | Date | null) => {
    if (!timestamp) return { date: 'Unknown', time: 'Unknown' };
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
            Complete audit trail showing voting activities and payment history for this event
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="voting" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                Voting History ({auditLogs.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <CreditCardIcon className="h-4 w-4" />
                Payment History ({paymentRecords.length + transactions.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="voting" className="max-h-[50vh] overflow-y-auto mt-4">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  No voting activity recorded for this event yet
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
            </TabsContent>
            
            <TabsContent value="payments" className="max-h-[50vh] overflow-y-auto mt-4">
              {paymentRecords.length === 0 && transactions.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  No payment activity recorded for this event yet
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Event Payment Records */}
                  {paymentRecords.map((payment: any) => {
                    const dateTime = formatDateTime(payment.createdAt);
                    const isAuthorized = payment.status === 'hold_created';
                    const isCaptured = payment.status === 'captured';
                    
                    return (
                      <div key={`payment-${payment.id}`} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="bg-green-500 p-2 rounded-lg">
                            <CreditCardIcon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-neutral-900">
                                {payment.user?.firstName} {payment.user?.lastName}
                              </span>
                              <Badge className={isCaptured ? 'bg-green-100 text-green-800' : isAuthorized ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}>
                                {isCaptured ? 'Payment Captured' : isAuthorized ? 'Payment Authorized' : payment.status}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-neutral-600 space-y-1">
                              <div className="flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {dateTime.date} at {dateTime.time}
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <DollarSignIcon className="h-3 w-3" />
                                Amount: £{(payment.finalAmount || payment.holdAmount || 0).toFixed(2)}
                              </div>
                              
                              {payment.paymentIntentId && (
                                <div className="text-xs text-neutral-400">
                                  Payment Intent: {payment.paymentIntentId}
                                </div>
                              )}
                              
                              {payment.capturedAt && (
                                <div className="text-xs text-neutral-500">
                                  Captured: {formatDateTime(payment.capturedAt).date} at {formatDateTime(payment.capturedAt).time}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Legacy Payment Transactions */}
                  {transactions.map((transaction: any) => {
                    const dateTime = formatDateTime(transaction.createdAt || transaction.paidAt);
                    
                    return (
                      <div key={`transaction-${transaction.id}`} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="bg-blue-500 p-2 rounded-lg">
                            <DollarSignIcon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-neutral-900">
                                {transaction.user?.firstName} {transaction.user?.lastName}
                              </span>
                              <Badge className="bg-blue-100 text-blue-800">
                                {transaction.type || 'Payment'}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-neutral-600 space-y-1">
                              <div className="flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {dateTime.date} at {dateTime.time}
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <DollarSignIcon className="h-3 w-3" />
                                Amount: £{(transaction.amount || 0).toFixed(2)}
                              </div>
                              
                              <div className="text-xs text-neutral-500">
                                Status: {transaction.status}
                              </div>
                              
                              {transaction.stripePaymentIntentId && (
                                <div className="text-xs text-neutral-400">
                                  Stripe Intent: {transaction.stripePaymentIntentId}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}