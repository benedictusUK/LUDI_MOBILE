import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/ui/nav";
import TeamForm from "@/components/ui/team-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Teams() {
  const [showCreateForm, setShowCreateForm] = useState(false);

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

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {teams.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <i className="fas fa-users text-neutral-300 text-6xl mb-4"></i>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No teams yet</h3>
              <p className="text-neutral-500 mb-4">Create your first team to get started</p>
              <Button onClick={() => setShowCreateForm(true)}>
                Create Team
              </Button>
            </div>
          ) : (
            teams.map((team: any) => (
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
                    <Button size="sm" className="flex-1">
                      {team.role === "admin" ? "Manage" : "View"}
                    </Button>
                    <Button size="sm" variant="outline">
                      Events
                    </Button>
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
      </main>
    </div>
  );
}
