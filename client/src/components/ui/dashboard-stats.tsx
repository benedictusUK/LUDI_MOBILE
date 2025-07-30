import { Card, CardContent } from "@/components/ui/card";

interface DashboardStatsProps {
  stats?: {
    upcomingEvents: number;
    activeTeams: number;
    totalPlayers: number;
    unreadNotifications: number;
  };
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-4 bg-neutral-200 rounded w-24 mb-2"></div>
                    <div className="h-8 bg-neutral-200 rounded w-16"></div>
                  </div>
                  <div className="h-12 w-12 bg-neutral-200 rounded-lg"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Upcoming Events</p>
              <p className="text-3xl font-bold text-neutral-900">{stats.upcomingEvents}</p>
            </div>
            <div className="bg-primary p-3 rounded-lg">
              <i className="fas fa-calendar text-white text-xl"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Active Teams</p>
              <p className="text-3xl font-bold text-neutral-900">{stats.activeTeams}</p>
            </div>
            <div className="bg-secondary p-3 rounded-lg">
              <i className="fas fa-users text-white text-xl"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Total Players</p>
              <p className="text-3xl font-bold text-neutral-900">{stats.totalPlayers}</p>
            </div>
            <div className="bg-accent p-3 rounded-lg">
              <i className="fas fa-user-friends text-white text-xl"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Notifications</p>
              <p className="text-3xl font-bold text-neutral-900">{stats.unreadNotifications}</p>
            </div>
            <div className="bg-yellow-500 p-3 rounded-lg">
              <i className="fas fa-bell text-white text-xl"></i>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
