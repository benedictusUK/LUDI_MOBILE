import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { SPORTS } from "@shared/schema";
import { 
  Search, 
  MapPin, 
  Users, 
  Calendar,
  Clock,
  Target,
  Zap
} from "lucide-react";

export default function FlareSearch() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useState({
    postcode: "",
    radius: "10",
    sport: "all"
  });
  const [hasSearched, setHasSearched] = useState(false);

  // Search for flare gun events
  const { data: flareEvents = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/flare-events", searchParams.postcode, searchParams.radius, searchParams.sport],
    enabled: false, // Only search when user clicks search
  });

  const handleSearch = () => {
    if (!searchParams.postcode) return;
    setHasSearched(true);
    refetch();
  };

  const resetSearch = () => {
    setSearchParams({ postcode: "", radius: "10", sport: "all" });
    setHasSearched(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Target className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Flare Gun Events</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Discover sports events near you that need players. Enter your location and find events 
          where organizers are actively seeking participants.
        </p>
      </div>

      {/* Search Form */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Events
          </CardTitle>
          <CardDescription>
            Find flare gun events in your area
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode *</Label>
              <Input
                id="postcode"
                placeholder="Enter postcode"
                value={searchParams.postcode}
                onChange={(e) => setSearchParams(prev => ({ ...prev, postcode: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="radius">Radius (miles)</Label>
              <Select 
                value={searchParams.radius} 
                onValueChange={(value) => setSearchParams(prev => ({ ...prev, radius: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select radius" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 miles</SelectItem>
                  <SelectItem value="10">10 miles</SelectItem>
                  <SelectItem value="15">15 miles</SelectItem>
                  <SelectItem value="25">25 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sport">Sport (optional)</Label>
              <Select 
                value={searchParams.sport} 
                onValueChange={(value) => setSearchParams(prev => ({ ...prev, sport: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any sport</SelectItem>
                  {SPORTS.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleSearch} 
              disabled={!searchParams.postcode || isLoading}
              className="flex-1"
            >
              <Search className="w-4 h-4 mr-2" />
              {isLoading ? "Searching..." : "Search Events"}
            </Button>
            {hasSearched && (
              <Button variant="outline" onClick={resetSearch}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Search Results</h2>
            <Badge variant="secondary">
              {flareEvents.length} events found
            </Badge>
          </div>

          {flareEvents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No events found</h3>
                <p className="text-muted-foreground mb-4">
                  No flare gun events found in your search area. Try expanding your radius or changing the sport filter.
                </p>
                <Button variant="outline" onClick={() => setSearchParams(prev => ({ ...prev, radius: "25" }))}>
                  Expand to 25 miles
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {flareEvents.map((event: any) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold">{event.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(event.startDate).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {event.startTime}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.location}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{event.sport}</Badge>
                        <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                          <Zap className="h-3 w-3 mr-1" />
                          Needs Players
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {event.team?.name?.[0]?.toUpperCase() || "T"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-sm">
                          <div className="font-medium">{event.team?.name}</div>
                          <div className="text-muted-foreground">
                            {event.distance && `${Math.round(event.distance)} miles away`}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        <Button size="sm">
                          <Users className="w-4 h-4 mr-1" />
                          Join Event
                        </Button>
                      </div>
                    </div>

                    {event.requirements && (
                      <>
                        <Separator className="my-4" />
                        <div className="text-sm">
                          <span className="font-medium">Requirements: </span>
                          <span className="text-muted-foreground">{event.requirements}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}