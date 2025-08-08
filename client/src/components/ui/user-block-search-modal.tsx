import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Badge } from "./badge";
import { Textarea } from "./textarea";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Ban, User, AlertTriangle } from "lucide-react";

interface UserSearchResult {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  phoneNumber: string | null;
}

interface UserBlockSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  onBlock: (userId: string, reason?: string) => void;
  isBlocking: boolean;
}

export function UserBlockSearchModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  onBlock,
  isBlocking,
}: UserBlockSearchModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [localBlockReason, setLocalBlockReason] = useState("");
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
        const response = await apiRequest("GET", `/api/users/search?q=${encodeURIComponent(searchQuery)}&excludeBlocked=${teamId}`);
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
  }, [searchQuery, toast]);

  const handleUserSelect = (user: UserSearchResult) => {
    setSelectedUser(user);
  };

  const handleBlock = () => {
    if (!selectedUser) return;
    onBlock(selectedUser.id, localBlockReason || undefined);
  };

  const resetModal = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUser(null);
    setLocalBlockReason("");
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const getUserDisplayName = (user: UserSearchResult) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email;
  };

  const getUserInitials = (user: UserSearchResult) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
    }
    return user.username?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <Ban className="h-5 w-5" />
            Block Users from {teamName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, email, or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div className="border rounded-lg p-2">
              <h3 className="text-sm font-medium mb-2">Search Results</h3>
              <ScrollArea className="h-48">
                {isSearching ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Searching users...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No users found matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedUser?.id === user.id
                            ? "bg-red-50 border-red-200"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => handleUserSelect(user)}
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.profileImageUrl || ""} />
                            <AvatarFallback className="text-xs">
                              {getUserInitials(user)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {getUserDisplayName(user)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              @{user.username} • {user.email}
                            </div>
                          </div>
                        </div>
                        {selectedUser?.id === user.id && (
                          <Badge variant="destructive">Selected</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Selected User */}
          {selectedUser && (
            <div className="border rounded-lg p-4 bg-red-50 border-red-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-red-700">User to Block</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUser(null)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.profileImageUrl || ""} />
                  <AvatarFallback>
                    {getUserInitials(selectedUser)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {getUserDisplayName(selectedUser)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    @{selectedUser.username} • {selectedUser.email}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Block Reason */}
          {selectedUser && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Block Reason (Optional)</label>
              <Textarea
                value={localBlockReason}
                onChange={(e) => setLocalBlockReason(e.target.value)}
                placeholder="Enter reason for blocking this user..."
                className="resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Blocked users won't receive flare notifications from this team
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isBlocking}>
              Cancel
            </Button>
            <Button
              onClick={handleBlock}
              disabled={!selectedUser || isBlocking}
              className="bg-red-600 hover:bg-red-700"
            >
              {isBlocking ? "Blocking..." : "Block User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}