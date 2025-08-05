import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";

interface DashboardStatsProps {
  stats?: {
    upcomingEvents: number;
    activeTeams: number;
    totalPlayers: number;
    unreadNotifications: number;
  };
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const [, setLocation] = useLocation();

  if (!stats) {
    return (
      <div className="space-y-3 mb-6">
        {/* Loading state for top row */}
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="animate-pulse">
                  <div className="h-3 bg-neutral-200 rounded w-20 mb-1"></div>
                  <div className="h-6 bg-neutral-200 rounded w-12"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Loading state for bottom row */}
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="animate-pulse">
                  <div className="h-3 bg-neutral-200 rounded w-16 mb-1"></div>
                  <div className="h-5 bg-neutral-200 rounded w-10"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Top row - 2 thin tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-neutral-500">Total Teams</p>
            <p className="text-xl font-bold text-neutral-900">{stats.activeTeams}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-medium text-neutral-500">Total Players</p>
            <p className="text-xl font-bold text-neutral-900">{stats.totalPlayers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row - 3 tiles */}
      <div className="grid grid-cols-3 gap-2">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setLocation("/events")}
        >
          <CardContent className="p-3">
            <p className="text-xs font-medium text-neutral-500">My Events</p>
            <p className="text-lg font-bold text-neutral-900">{stats.upcomingEvents}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setLocation("/teams")}
        >
          <CardContent className="p-3">
            <p className="text-xs font-medium text-neutral-500">My Teams</p>
            <p className="text-lg font-bold text-neutral-900">{stats.activeTeams}</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setLocation("/notifications")}
        >
          <CardContent className="p-3">
            <p className="text-xs font-medium text-neutral-500">Notifications</p>
            <p className="text-lg font-bold text-neutral-900">{stats.unreadNotifications}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
