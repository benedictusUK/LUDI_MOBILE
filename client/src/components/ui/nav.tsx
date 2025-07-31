import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navigation() {
  const { user } = useAuth();
  const [location] = useLocation();

  const { data: stats = {} } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <i className="fas fa-trophy text-primary text-2xl mr-3"></i>
              <span className="text-xl font-bold text-neutral-900">SportSync</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link href="/" className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive("/") 
                  ? "text-primary" 
                  : "text-neutral-500 hover:text-neutral-900"
              }`}>
                Dashboard
              </Link>
              <Link href="/events" className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive("/events") 
                  ? "text-primary" 
                  : "text-neutral-500 hover:text-neutral-900"
              }`}>
                Events
              </Link>
              <Link href="/teams" className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive("/teams") 
                  ? "text-primary" 
                  : "text-neutral-500 hover:text-neutral-900"
              }`}>
                Teams
              </Link>
              <Link href="/notifications" className={`px-3 py-2 rounded-md text-sm font-medium relative ${
                isActive("/notifications") 
                  ? "text-primary" 
                  : "text-neutral-500 hover:text-neutral-900"
              }`}>
                Notifications
                {(stats as any)?.unreadNotifications > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
                  >
                    {(stats as any).unreadNotifications}
                  </Badge>
                )}
              </Link>
              <Link href="/settings" className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive("/settings") 
                  ? "text-primary" 
                  : "text-neutral-500 hover:text-neutral-900"
              }`}>
                Settings
              </Link>
            </div>
          </div>

          {/* User Menu */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <Link href="/notifications">
                <Button variant="ghost" size="sm" className="p-2 relative">
                  <i className="fas fa-bell text-lg"></i>
                  {(stats as any)?.unreadNotifications > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-xs p-0"
                    >
                      {(stats as any).unreadNotifications}
                    </Badge>
                  )}
                </Button>
              </Link>
              <div className="ml-3 relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center space-x-2">
                      <img 
                        className="h-8 w-8 rounded-full object-cover" 
                        src={(user as any)?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                        alt="User avatar"
                      />
                      <span className="text-sm font-medium text-neutral-900">
                        {(user as any)?.firstName || "User"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleLogout}>
                      <i className="fas fa-sign-out-alt mr-2"></i>
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm">
              <i className="fas fa-bars text-xl"></i>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
