import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Badge } from "./badge";
import { Checkbox } from "./checkbox";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, UserPlus, Mail, User, X } from "lucide-react";

interface UserSearchResult {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  phoneNumber: string | null;
}

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
}

export function UserSearchModal({
  isOpen,
  onClose,
  teamId,
  teamName,
}: UserSearchModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search users with debouncing
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiRequest("GET", `/api/users/search?q=${encodeURIComponent(searchQuery)}&excludeTeam=${teamId}`);
        const users = await response.json();
        setSearchResults(users);
      } catch (error) {
        console.error("Error searching users:", error);
        toast({
          title: "Search Error",
          description: "Failed to search users. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, teamId, toast]);

  // Send invitations mutation
  const sendInvitationsMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const promises = userIds.map(userId =>
        apiRequest("POST", `/api/teams/${teamId}/invitations`, { userId })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Invitations Sent",
        description: `Successfully sent ${selectedUsers.length} invitation${selectedUsers.length !== 1 ? 's' : ''} to join ${teamName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "members"] });
      onClose();
      setSelectedUsers([]);
      setSearchQuery("");
      setSearchResults([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitations",
        variant: "destructive",
      });
    },
  });

  const toggleUserSelection = (user: UserSearchResult) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleSendInvitations = () => {
    if (selectedUsers.length === 0) return;
    sendInvitationsMutation.mutate(selectedUsers.map(u => u.id));
  };

  const resetModal = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUsers([]);
  };

  const getUserDisplayName = (user: UserSearchResult) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username;
  };

  const getUserInitials = (user: UserSearchResult) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.username.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        resetModal();
      }
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Players to {teamName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by username, email, phone, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Selected Users ({selectedUsers.length})</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUsers([])}
                >
                  Clear All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {getUserDisplayName(user)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeSelectedUser(user.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <Separator />
            </div>
          )}

          {/* Search Results */}
          <div className="flex-1 min-h-0">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                <span className="ml-2 text-sm text-gray-600">Searching...</span>
              </div>
            ) : searchQuery.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Search className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Enter at least 2 characters to search for users</p>
                <p className="text-xs mt-1">Search by username, email, or name</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <User className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">No users found matching "{searchQuery}"</p>
                <p className="text-xs mt-1">Try different search terms</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {searchResults.map((user) => {
                    const isSelected = selectedUsers.some(u => u.id === user.id);
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-gray-50 border-gray-200"
                        }`}
                        onClick={() => toggleUserSelection(user)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => {}} // Handled by onClick above
                        />
                        
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-primary/10">
                            {getUserInitials(user)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm truncate">
                              {getUserDisplayName(user)}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              @{user.username}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {user.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <span className="truncate max-w-32">{user.email}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
            <div className="text-sm text-gray-500">
              {selectedUsers.length > 0 && (
                <>
                  {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                </>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => {
                onClose();
                resetModal();
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleSendInvitations}
                disabled={selectedUsers.length === 0 || sendInvitationsMutation.isPending}
              >
                {sendInvitationsMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    Send {selectedUsers.length > 0 ? `${selectedUsers.length} ` : ''}Invitation{selectedUsers.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}