import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Navigation from "@/components/ui/nav";
import TeamForm from "@/components/ui/team-form";
import { MemberManagementModal } from "@/components/ui/member-management-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from '@uppy/core';

// Sports options
const SPORTS_OPTIONS = [
  "Football", "Basketball", "Tennis", "Baseball", "Soccer", "Rugby", 
  "Cricket", "Volleyball", "Swimming", "Running", "Cycling", "Golf",
  "Hockey", "Badminton", "Table Tennis", "Boxing", "Wrestling", "Skiing",
  "Snowboarding", "Surfing", "Rock Climbing", "Martial Arts", "Yoga", "Other"
];

// Multi-select component for sports
function SportsMultiSelect({ 
  value, 
  onChange, 
  placeholder = "Select sports...",
  disabled = false
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [selectedSports, setSelectedSports] = useState<string[]>(value);
  const [isOpen, setIsOpen] = useState(false);

  const toggleSport = (sport: string) => {
    if (disabled) return;
    const newSelection = selectedSports.includes(sport)
      ? selectedSports.filter(s => s !== sport)
      : [...selectedSports, sport];
    
    setSelectedSports(newSelection);
    onChange(newSelection);
  };

  const removeSport = (sport: string) => {
    if (disabled) return;
    const newSelection = selectedSports.filter(s => s !== sport);
    setSelectedSports(newSelection);
    onChange(newSelection);
  };

  return (
    <div className="space-y-2">
      <Select open={isOpen} onOpenChange={setIsOpen} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder}>
            {selectedSports.length === 0 ? placeholder : `${selectedSports.length} sport${selectedSports.length !== 1 ? 's' : ''} selected`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SPORTS_OPTIONS.map(sport => (
            <SelectItem 
              key={sport} 
              value={sport}
              onSelect={(e) => {
                e.preventDefault();
                toggleSport(sport);
              }}
            >
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedSports.includes(sport)}
                  onChange={() => toggleSport(sport)}
                  className="rounded"
                />
                <span>{sport}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedSports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSports.map(sport => (
            <Badge 
              key={sport} 
              variant="secondary" 
              className={disabled ? "" : "cursor-pointer"}
              onClick={() => !disabled && removeSport(sport)}
            >
              {sport}
              {!disabled && <i className="fas fa-times ml-1"></i>}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Team Settings Modal Component
function TeamSettingsModal({ team, onClose, onSave, isLoading }: {
  team: any;
  onClose: () => void;
  onSave: (updates: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: team.name || "",
    sports: team.sports || [],
    description: team.description || "",
    isPrivate: team.isPrivate || false,
    requiresApproval: team.requiresApproval || false,
  });

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div 
          className="p-6 border-b"
          style={{ 
            background: `linear-gradient(135deg, ${team.color || '#3b82f6'}, ${team.color || '#3b82f6'}dd)` 
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Team Settings
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <i className="fas fa-times"></i>
            </Button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-neutral-900">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={team.role !== "admin"}
                />
              </div>
              <div>
                <Label htmlFor="teamSports">Sports</Label>
                <SportsMultiSelect
                  value={formData.sports}
                  onChange={(value) => setFormData({ ...formData, sports: value })}
                  placeholder="Select sports..."
                  disabled={team.role !== "admin"}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="teamDescription">Description</Label>
              <Textarea
                id="teamDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your team..."
                disabled={team.role !== "admin"}
              />
            </div>
          </div>

          {/* Team Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-neutral-900">Team Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Private Team</Label>
                  <p className="text-sm text-neutral-500">Only invited members can join</p>
                </div>
                <Switch 
                  checked={formData.isPrivate}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPrivate: checked })}
                  disabled={team.role !== "admin"}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Approval</Label>
                  <p className="text-sm text-neutral-500">Admin must approve new members</p>
                </div>
                <Switch 
                  checked={formData.requiresApproval}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresApproval: checked })}
                  disabled={team.role !== "admin"}
                />
              </div>
            </div>
          </div>

          {/* Invite Code */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-neutral-900">Invite Code</h3>
            <div className="flex items-center space-x-2">
              <Input
                value={team.inviteCode || "No invite code generated"}
                readOnly
                className="flex-1"
              />
              <Button variant="outline" size="sm">
                <i className="fas fa-copy"></i>
              </Button>
              {team.role === "admin" && (
                <Button variant="outline" size="sm">
                  Regenerate
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-neutral-50 flex justify-end space-x-3">
          <Button 
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          {team.role === "admin" && (
            <Button
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Teams() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showMemberManagement, setShowMemberManagement] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["/api/teams"],
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["/api/teams", selectedTeam?.id, "members"],
    enabled: !!selectedTeam?.id && showMembersModal,
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await apiRequest("DELETE", `/api/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowDeleteModal(false);
      setShowManageModal(false);
      toast({
        title: "Success",
        description: "Team deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive",
      });
    },
  });



  // Update team settings mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, updates }: { teamId: string; updates: any }) => {
      await apiRequest("PUT", `/api/teams/${teamId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowSettingsModal(false);
      toast({
        title: "Success",
        description: "Team settings updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update team settings",
        variant: "destructive",
      });
    },
  });

  // Search teams functionality
  const searchTeams = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiRequest("GET", `/api/teams/search?q=${encodeURIComponent(query.trim())}`);
      setSearchResults(await response.json());
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      toast({
        title: "Error",
        description: "Failed to search teams",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Join team mutation
  const joinTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/request-join`);
      return response;
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "Success",
        description: data.message || "Successfully joined team",
      });
      setShowSearchModal(false);
      setSearchQuery("");
      setSearchResults([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join team",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">Team Management</h1>
              <p className="text-neutral-500">Create and manage your sports teams</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline"
                onClick={() => setShowSearchModal(true)}
                className="flex items-center justify-center space-x-2"
              >
                <i className="fas fa-search"></i>
                <span>Search Teams</span>
              </Button>
              <Button 
                onClick={() => setShowCreateForm(true)}
                className="flex items-center justify-center space-x-2"
              >
                <i className="fas fa-plus"></i>
                <span>Create Team</span>
              </Button>
            </div>
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-8">
            <TeamForm 
              onCancel={() => setShowCreateForm(false)}
              onSuccess={() => setShowCreateForm(false)}
            />
          </div>
        )}

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {(teams as any[]).length === 0 ? (
            <div className="col-span-full text-center py-12">
              <i className="fas fa-users text-neutral-300 text-6xl mb-4"></i>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No teams yet</h3>
              <p className="text-neutral-500 mb-4">Create your first team to get started</p>
              <Button onClick={() => setShowCreateForm(true)}>
                Create Team
              </Button>
            </div>
          ) : (
            (teams as any[]).map((team: any) => (
              <Card key={team.id} className="overflow-hidden">
                <div className="h-32 relative">
                  {team.teamImagePath ? (
                    <img 
                      src={team.teamImagePath}
                      alt={`${team.name} team image`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center"
                      style={{ 
                        background: `linear-gradient(135deg, ${team.color || '#3b82f6'}, ${team.color || '#3b82f6'}dd)` 
                      }}
                    >
                      <i className="fas fa-users text-white text-4xl opacity-50"></i>
                    </div>
                  )}
                  
                  {/* Upload button for team owners */}
                  {team.isOwner && (
                    <div className="absolute top-4 left-4">
                      <ObjectUploader
                        maxNumberOfFiles={1}
                        maxFileSize={5242880} // 5MB
                        onGetUploadParameters={async () => {
                          try {
                            console.log('Requesting upload URL...');
                            const response = await apiRequest('POST', '/api/objects/upload');
                            console.log('Raw response:', response);
                            const data = await response.json();
                            console.log('Parsed upload response:', data);
                            console.log('Upload URL:', data.uploadURL);
                            if (!data.uploadURL) {
                              throw new Error('No upload URL received');
                            }
                            const result = {
                              method: 'PUT' as const,
                              url: data.uploadURL,
                            };
                            console.log('Returning to Uppy:', result);
                            return result;
                          } catch (error) {
                            console.error('Error getting upload parameters:', error);
                            throw error;
                          }
                        }}
                        onComplete={async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
                          if (result.successful && result.successful.length > 0) {
                            const uploadedFile = result.successful[0];
                            console.log('Upload result:', uploadedFile);
                            try {
                              const updateResponse = await apiRequest('PUT', `/api/teams/${team.id}/image`, { imageURL: uploadedFile.uploadURL });
                              const updateData = await updateResponse.json();
                              console.log('Image update response:', updateData);
                              
                              // Refresh teams data
                              queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
                              toast({ title: "Team image updated successfully!" });
                            } catch (error) {
                              console.error('Error updating team image:', error);
                              toast({ 
                                title: "Error updating team image", 
                                description: "Please try again.",
                                variant: "destructive" 
                              });
                            }
                          }
                        }}
                        buttonClassName="bg-black/20 hover:bg-black/40 text-white border-white/30 text-xs"
                      >
                        <i className="fas fa-camera mr-1"></i>
                        Upload
                      </ObjectUploader>
                    </div>
                  )}
                  
                  <div className="absolute top-4 right-4">
                    <Badge variant={
                      team.isOwner ? "default" :
                      team.role === "admin" ? "secondary" :
                      team.role === "captain" ? "secondary" :
                      "outline"
                    } className={
                      team.isOwner ? "bg-yellow-100 text-yellow-800" :
                      team.role === "admin" ? "bg-blue-100 text-blue-800" :
                      team.role === "captain" ? "bg-green-100 text-green-800" :
                      ""
                    }>
                      {team.isOwner ? "Owner" : team.role === "captain" ? "Captain" : team.role}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: team.color || '#3b82f6' }}
                    >
                      <i className="fas fa-football-ball text-white text-lg"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">{team.name}</h3>
                      <p className="text-sm text-neutral-500">
                        {team.sports && team.sports.length > 0 ? team.sports.join(', ') : 'No sports set'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Members:</span>
                      <span className="font-medium text-neutral-900">
                        {team.memberCount}/{team.maxPlayers || 30}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Status:</span>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowManageModal(true);
                      }}
                    >
                      {team.role === "admin" ? "Manage" : "View"}
                    </Button>
                    <Link href={`/events?team=${team.id}`}>
                      <Button size="sm" variant="outline" className="w-full">
                        Events
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Team Creation Form */}
        {showCreateForm && (
          <TeamForm 
            onCancel={() => setShowCreateForm(false)}
            onSuccess={() => setShowCreateForm(false)}
          />
        )}

        {/* Team Management Modal */}
        {showManageModal && selectedTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div 
                className="p-6 border-b relative"
                style={{ 
                  background: `linear-gradient(135deg, ${selectedTeam.color || '#3b82f6'}, ${selectedTeam.color || '#3b82f6'}dd)` 
                }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">
                    Manage {selectedTeam.name}
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowManageModal(false)}
                    className="text-white hover:bg-white/20"
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Team Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-neutral-500">Team Name</label>
                    <p className="text-neutral-900">{selectedTeam.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-500">Sport</label>
                    <p className="text-neutral-900">{selectedTeam.sport}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-500">Members</label>
                    <p className="text-neutral-900">{selectedTeam.memberCount}/{selectedTeam.maxPlayers || "No limit"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-500">Your Role</label>
                    <Badge variant="secondary">{selectedTeam.role}</Badge>
                  </div>
                </div>

                {/* Management Actions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-neutral-900">Management Actions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="flex items-center space-x-2"
                      onClick={() => setShowMembersModal(true)}
                    >
                      <i className="fas fa-users"></i>
                      <span>View Members</span>
                    </Button>
                    {(selectedTeam.isOwner || selectedTeam.role === "admin") && (
                      <Button 
                        variant="outline" 
                        className="flex items-center space-x-2"
                        onClick={() => setShowMemberManagement(true)}
                      >
                        <i className="fas fa-user-cog"></i>
                        <span>Manage Members</span>
                      </Button>
                    )}
                    <Link href={`/events?team=${selectedTeam.id}`}>
                      <Button variant="outline" className="flex items-center space-x-2 w-full">
                        <i className="fas fa-calendar"></i>
                        <span>Team Events</span>
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      className="flex items-center space-x-2"
                      onClick={() => setShowSettingsModal(true)}
                    >
                      <i className="fas fa-cog"></i>
                      <span>Settings</span>
                    </Button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-neutral-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-neutral-900 mb-3">Quick Stats</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">0</p>
                      <p className="text-xs text-neutral-500">Events This Month</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-secondary">0</p>
                      <p className="text-xs text-neutral-500">Pending Invites</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent">Active</p>
                      <p className="text-xs text-neutral-500">Team Status</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-neutral-50 flex justify-end space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowManageModal(false)}
                >
                  Close
                </Button>
                {selectedTeam.role === "admin" && (
                  <Button 
                    variant="destructive"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <i className="fas fa-trash mr-2"></i>
                    Delete Team
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}



        {/* View Members Modal */}
        {showMembersModal && selectedTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-neutral-900">
                    {selectedTeam.name} Members
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowMembersModal(false)}
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {(teamMembers as any[]).length === 0 ? (
                    <div className="text-center py-8">
                      <i className="fas fa-users text-neutral-300 text-4xl mb-4"></i>
                      <h3 className="text-lg font-medium text-neutral-900 mb-2">No members yet</h3>
                      <p className="text-neutral-500">Invite members to start building your team</p>
                    </div>
                  ) : (
                    (teamMembers as any[]).map((member: any) => (
                      <div key={member.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <span className="text-white font-medium">
                              {member.firstName?.[0] || member.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-medium text-neutral-900">
                              {member.firstName && member.lastName 
                                ? `${member.firstName} ${member.lastName}` 
                                : member.email
                              }
                            </h4>
                            <p className="text-sm text-neutral-500">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            member.role === "admin" ? "default" :
                            member.role === "captain" ? "secondary" :
                            "outline"
                          }>
                            {member.role}
                          </Badge>
                          {selectedTeam.role === "admin" && member.role !== "admin" && (
                            <Button variant="ghost" size="sm">
                              <i className="fas fa-ellipsis-v"></i>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-6 border-t bg-neutral-50 flex justify-end">
                <Button onClick={() => setShowMembersModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Team Settings Modal */}
        {showSettingsModal && selectedTeam && (
          <TeamSettingsModal 
            team={selectedTeam}
            onClose={() => setShowSettingsModal(false)}
            onSave={(updates) => updateTeamMutation.mutate({ teamId: selectedTeam.id, updates })}
            isLoading={updateTeamMutation.isPending}
          />
        )}

        {/* Delete Team Confirmation Modal */}
        {showDeleteModal && selectedTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-red-600">
                  Delete Team
                </h2>
              </div>
              
              <div className="p-6">
                <p className="text-neutral-700 mb-4">
                  Are you sure you want to delete <strong>{selectedTeam.name}</strong>? 
                  This action cannot be undone.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">This will permanently:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• Remove all team members</li>
                    <li>• Delete all team events</li>
                    <li>• Remove all team data</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 border-t bg-neutral-50 flex justify-end space-x-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => deleteTeamMutation.mutate(selectedTeam.id)}
                  disabled={deleteTeamMutation.isPending}
                >
                  {deleteTeamMutation.isPending ? "Deleting..." : "Delete Team"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search Teams Modal */}
        {showSearchModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-neutral-900">
                    Search Teams
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setShowSearchModal(false);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <Label htmlFor="searchInput">Team Name</Label>
                  <Input
                    id="searchInput"
                    type="text"
                    placeholder="Enter team name to search..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      searchTeams(e.target.value);
                    }}
                    className="mt-1"
                  />
                </div>

                {isSearching && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                    <span className="ml-2 text-neutral-600">Searching...</span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium text-neutral-900">Search Results</h3>
                    {searchResults.map((team: any) => (
                      <div key={team.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div 
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: team.color || '#3b82f6' }}
                          >
                            {team.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-medium text-neutral-900">{team.name}</h4>
                            <p className="text-sm text-neutral-500">
                              {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                            </p>
                            {team.sports && team.sports.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {team.sports.slice(0, 3).map((sport: string) => (
                                  <Badge key={sport} variant="outline" className="text-xs">
                                    {sport}
                                  </Badge>
                                ))}
                                {team.sports.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{team.sports.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {team.isMember ? (
                            <Badge variant="secondary">Member</Badge>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={() => joinTeamMutation.mutate(team.id)}
                              disabled={joinTeamMutation.isPending}
                            >
                              {team.requiresApproval ? "Request to Join" : "Join Team"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                  <div className="text-center py-8">
                    <i className="fas fa-search text-neutral-300 text-4xl mb-4"></i>
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No teams found</h3>
                    <p className="text-neutral-500">Try searching with different keywords</p>
                  </div>
                )}

                {searchQuery.length < 2 && (
                  <div className="text-center py-8">
                    <i className="fas fa-search text-neutral-300 text-4xl mb-4"></i>
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">Search for teams</h3>
                    <p className="text-neutral-500">Enter at least 2 characters to search</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t bg-neutral-50 flex justify-end">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowSearchModal(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Member Management Modal */}
        {showMemberManagement && selectedTeam && (
          <MemberManagementModal
            isOpen={showMemberManagement}
            onClose={() => setShowMemberManagement(false)}
            teamId={selectedTeam.id}
            teamName={selectedTeam.name}
            isOwner={selectedTeam.isOwner || false}
            isAdmin={selectedTeam.role === 'admin' || selectedTeam.isOwner}
          />
        )}
      </main>
    </div>
  );
}
