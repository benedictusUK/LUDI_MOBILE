import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Navigation from "@/components/ui/nav";
import DashboardStats from "@/components/ui/dashboard-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  const { data: events = [] } = useQuery({
    queryKey: ["/api/events"],
  });

  const recentEvents = (events as any[]).slice(0, 3);
  const userTeams = (teams as any[]).slice(0, 3);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Welcome back, {(user as any)?.firstName || "User"}!
          </h1>
          <p className="text-neutral-500">Overview of your sports activities and upcoming events</p>
        </div>

        {/* Stats Grid */}
        <DashboardStats stats={stats as any} />

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/events">
                <Button variant="outline" className="flex flex-col items-center p-6 h-auto space-y-2 w-full">
                  <div className="bg-primary p-3 rounded-lg">
                    <i className="fas fa-plus text-white text-lg"></i>
                  </div>
                  <span className="text-sm font-medium">Create Event</span>
                </Button>
              </Link>

              <Link href="/teams">
                <Button variant="outline" className="flex flex-col items-center p-6 h-auto space-y-2 w-full">
                  <div className="bg-secondary p-3 rounded-lg">
                    <i className="fas fa-users-plus text-white text-lg"></i>
                  </div>
                  <span className="text-sm font-medium">Create Team</span>
                </Button>
              </Link>

              <Link href="/events">
                <Button variant="outline" className="flex flex-col items-center p-6 h-auto space-y-2 w-full">
                  <div className="bg-accent p-3 rounded-lg">
                    <i className="fas fa-calendar-alt text-white text-lg"></i>
                  </div>
                  <span className="text-sm font-medium">Schedule</span>
                </Button>
              </Link>

              <Link href="/notifications">
                <Button variant="outline" className="flex flex-col items-center p-6 h-auto space-y-2 w-full">
                  <div className="bg-purple-600 p-3 rounded-lg">
                    <i className="fas fa-bell text-white text-lg"></i>
                  </div>
                  <span className="text-sm font-medium">Notifications</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity & Teams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Events</CardTitle>
              <Button variant="link" className="text-primary">View All</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentEvents.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">No events found</p>
                ) : (
                  recentEvents.map((event: any) => (
                    <div key={event.id} className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg">
                      <div className="bg-primary p-3 rounded-lg">
                        <i className="fas fa-football-ball text-white"></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-neutral-900">{event.name}</h4>
                        <p className="text-sm text-neutral-500">
                          {new Date(event.startDate).toLocaleDateString()} • {event.startTime}
                        </p>
                        <p className="text-sm text-neutral-500">{event.location || "TBD"}</p>
                      </div>
                      <Badge variant={event.isPublished ? "default" : "secondary"}>
                        {event.isPublished ? "Active" : "Draft"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Your Teams */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Your Teams</CardTitle>
              <Button variant="link" className="text-primary">Manage All</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userTeams.length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">No teams found</p>
                ) : (
                  userTeams.map((team: any) => (
                    <div key={team.id} className="flex items-center space-x-4 p-4 border border-gray-100 rounded-lg">
                      <img 
                        src="https://pixabay.com/get/g5202462873eca9619d3df5dc0f91959d63be50f907aa2c040457382b8a99e807adb0e5247e5c503dc64ac68ca06a66f75cf609b2aa65f8cd9dfcf027f2207bfc_1280.jpg" 
                        alt={`${team.name} team`}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-neutral-900">{team.name}</h4>
                        <p className="text-sm text-neutral-500">{team.sport}</p>
                        <p className="text-sm text-neutral-500">{team.memberCount} members</p>
                      </div>
                      <Badge variant="outline" className={
                        team.role === "admin" ? "text-secondary" :
                        team.role === "captain" ? "text-primary" :
                        team.role === "coach" ? "text-purple-600" : "text-neutral-600"
                      }>
                        {team.role}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
