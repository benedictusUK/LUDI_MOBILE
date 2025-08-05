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
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3">
              <div className="animate-pulse">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="mb-2 sm:mb-0">
                    <div className="h-3 bg-neutral-200 rounded w-16 mb-1"></div>
                    <div className="h-5 bg-neutral-200 rounded w-12"></div>
                  </div>
                  <div className="h-8 w-8 bg-neutral-200 rounded-lg self-end sm:self-auto"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setLocation("/events")}
      >
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs sm:text-sm font-medium text-neutral-500">Upcoming Events</p>
              <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.upcomingEvents}</p>
            </div>
            <div className="bg-primary p-2 rounded-lg self-end sm:self-auto w-8 h-8 flex items-center justify-center">
              <i className="fas fa-calendar text-white text-sm"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setLocation("/teams")}
      >
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs sm:text-sm font-medium text-neutral-500">Active Teams</p>
              <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.activeTeams}</p>
            </div>
            <div className="bg-secondary p-2 rounded-lg self-end sm:self-auto w-8 h-8 flex items-center justify-center">
              <i className="fas fa-users text-white text-sm"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs sm:text-sm font-medium text-neutral-500">Total Players</p>
              <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.totalPlayers}</p>
            </div>
            <div className="bg-accent p-2 rounded-lg self-end sm:self-auto w-8 h-8 flex items-center justify-center">
              <i className="fas fa-user-friends text-white text-sm"></i>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => setLocation("/notifications")}
      >
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-2 sm:mb-0">
              <p className="text-xs sm:text-sm font-medium text-neutral-500">Notifications</p>
              <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.unreadNotifications}</p>
            </div>
            <div className="bg-yellow-500 p-2 rounded-lg self-end sm:self-auto w-8 h-8 flex items-center justify-center">
              <i className="fas fa-bell text-white text-sm"></i>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
