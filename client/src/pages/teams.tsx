import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import Navigation from "@/components/ui/nav";
import TeamForm from "@/components/ui/team-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Teams() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [showManageModal, setShowManageModal] = useState(false);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["/api/teams"],
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">Team Management</h1>
              <p className="text-neutral-500">Create and manage your sports teams</p>
            </div>
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="flex items-center space-x-2"
            >
              <i className="fas fa-plus"></i>
              <span>Create Team</span>
            </Button>
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
                <div className="h-32 bg-gradient-to-r from-primary to-blue-800 relative">
                  <img 
                    src="https://pixabay.com/get/g4180ccc4c1955ff77d8d09ee0a3f70c86ad763442d2be03a192f87a0e6c68bc3117c7a82bf4656202aff56e0d721e9767a71e5dcf4aaf368d865bf8caeb7be09_1280.jpg" 
                    alt={`${team.name} team banner`}
                    className="w-full h-full object-cover mix-blend-overlay"
                  />
                  <div className="absolute top-4 right-4">
                    <Badge variant={
                      team.role === "admin" ? "default" :
                      team.role === "captain" ? "secondary" :
                      "outline"
                    }>
                      {team.role}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <i className="fas fa-football-ball text-white text-lg"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900">{team.name}</h3>
                      <p className="text-sm text-neutral-500">{team.sport} Team</p>
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
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-neutral-900">
                    Manage {selectedTeam.name}
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowManageModal(false)}
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
                    <Button variant="outline" className="flex items-center space-x-2">
                      <i className="fas fa-user-plus"></i>
                      <span>Invite Members</span>
                    </Button>
                    <Button variant="outline" className="flex items-center space-x-2">
                      <i className="fas fa-users"></i>
                      <span>View Members</span>
                    </Button>
                    <Link href={`/events?team=${selectedTeam.id}`}>
                      <Button variant="outline" className="flex items-center space-x-2 w-full">
                        <i className="fas fa-calendar"></i>
                        <span>Team Events</span>
                      </Button>
                    </Link>
                    <Button variant="outline" className="flex items-center space-x-2">
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
                  <Button variant="destructive">
                    <i className="fas fa-trash mr-2"></i>
                    Delete Team
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
