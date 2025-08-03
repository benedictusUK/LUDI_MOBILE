import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";
import { Badge } from "./badge";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Separator } from "./separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Textarea } from "./textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Crown, Shield, User, Ban, CheckCircle, XCircle } from "lucide-react";

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  isOwner: boolean;
  isAdmin: boolean;
}

export function MemberManagementModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  isOwner,
  isAdmin,
}: MemberManagementModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [blockReason, setBlockReason] = useState("");

  // Fetch team members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["/api/teams", teamId, "members"],
    enabled: isOpen,
  });

  // Fetch blocked members
  const { data: blockedMembers = [], isLoading: blockedLoading } = useQuery({
    queryKey: ["/api/teams", teamId, "blocked"],
    enabled: isOpen,
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/teams/${teamId}/members/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "members"] });
      toast({ title: "Success", description: "Member role updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update member role", variant: "destructive" });
    },
  });

  // Block member mutation
  const blockMemberMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/block/${userId}`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "blocked"] });
      toast({ title: "Success", description: "Member blocked successfully" });
      setBlockReason("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to block member", variant: "destructive" });
    },
  });

  // Unblock member mutation
  const unblockMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/teams/${teamId}/block/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "blocked"] });
      toast({ title: "Success", description: "Member unblocked successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to unblock member", variant: "destructive" });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/api/teams/${teamId}/members/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "members"] });
      toast({ title: "Success", description: "Member removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove member", variant: "destructive" });
    },
  });

  const getRoleIcon = (role: string, isTeamOwner: boolean) => {
    if (isTeamOwner) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (role === "admin") return <Shield className="h-4 w-4 text-blue-500" />;
    return <User className="h-4 w-4 text-gray-500" />;
  };

  const getRoleBadge = (role: string, isTeamOwner: boolean) => {
    if (isTeamOwner) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Owner</Badge>;
    if (role === "admin") return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Admin</Badge>;
    return <Badge variant="outline">Member</Badge>;
  };

  const canManageMember = (memberUserId: string, memberRole: string, memberIsOwner: boolean) => {
    if (memberIsOwner) return false; // Cannot manage owner
    if (isOwner) return true; // Owner can manage everyone
    if (isAdmin && memberRole !== "admin") return true; // Admin can manage members but not other admins
    return false;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Manage {teamName}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">Team Members</TabsTrigger>
            <TabsTrigger value="blocked">Blocked Members</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <div className="space-y-4">
              {membersLoading ? (
                <div className="text-center py-8">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No members found</div>
              ) : (
                members.map((membership: any) => {
                  const isTeamOwner = membership.user.id === membership.team?.ownerId;
                  const canManage = canManageMember(membership.user.id, membership.role, isTeamOwner);

                  return (
                    <div key={membership.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getRoleIcon(membership.role, isTeamOwner)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {membership.user.firstName} {membership.user.lastName}
                            </span>
                            {getRoleBadge(membership.role, isTeamOwner)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{membership.user.username} • {membership.user.email}
                          </div>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center space-x-2">
                          {/* Role Management */}
                          <Select
                            value={membership.role}
                            onValueChange={(newRole) => 
                              updateRoleMutation.mutate({ userId: membership.user.id, role: newRole })
                            }
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                            </SelectContent>
                          </Select>

                          {/* Block Member */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => blockMemberMutation.mutate({ userId: membership.user.id, reason: blockReason })}
                            disabled={blockMemberMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>

                          {/* Remove Member */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeMemberMutation.mutate(membership.user.id)}
                            disabled={removeMemberMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="blocked" className="space-y-4">
            <div className="space-y-4">
              {blockedLoading ? (
                <div className="text-center py-8">Loading blocked members...</div>
              ) : blockedMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No blocked members</div>
              ) : (
                blockedMembers.map((blocked: any) => (
                  <div key={blocked.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">
                            {blocked.user.firstName} {blocked.user.lastName}
                          </span>
                          <Badge variant="destructive">Blocked</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          @{blocked.user.username} • {blocked.user.email}
                        </div>
                        {blocked.reason && (
                          <div className="text-sm text-red-600 mt-1">
                            Reason: {blocked.reason}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Blocked by {blocked.blockedBy.firstName} {blocked.blockedBy.lastName} on{" "}
                          {new Date(blocked.blockedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {(isOwner || isAdmin) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unblockMemberMutation.mutate(blocked.user.id)}
                        disabled={unblockMemberMutation.isPending}
                        className="text-green-600 hover:text-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Unblock
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Block Reason Input */}
            {(isOwner || isAdmin) && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Block Reason (Optional)</h4>
                <Textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Enter reason for blocking member..."
                  className="resize-none"
                  rows={2}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}