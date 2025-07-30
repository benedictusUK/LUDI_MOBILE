import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const eventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  sport: z.string().min(1, "Sport is required"),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  cost: z.string().optional(),
  requirements: z.string().optional(),
  recurrence: z.string().default("none"),
  primaryTeamId: z.string().min(1, "Primary team is required"),
  isPublished: z.boolean().default(false),
  enableVoting: z.boolean().default(false),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export default function EventForm({ onCancel, onSuccess }: EventFormProps) {
  const { toast } = useToast();
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: "",
      sport: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      location: "",
      cost: "0.00",
      requirements: "",
      recurrence: "none",
      primaryTeamId: "",
      isPublished: false,
      enableVoting: false,
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData & { additionalTeamIds: string[] }) => {
      await apiRequest("POST", "/api/events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      onSuccess();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EventFormData) => {
    createEventMutation.mutate({
      ...data,
      additionalTeamIds: selectedTeams,
    });
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Event</CardTitle>
        <p className="text-neutral-500">Set up your sports event with all the necessary details</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Event Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="Enter event name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sport">Sport/Game *</Label>
              <Select onValueChange={(value) => form.setValue("sport", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="football">Football</SelectItem>
                  <SelectItem value="basketball">Basketball</SelectItem>
                  <SelectItem value="volleyball">Volleyball</SelectItem>
                  <SelectItem value="tennis">Tennis</SelectItem>
                  <SelectItem value="soccer">Soccer</SelectItem>
                  <SelectItem value="baseball">Baseball</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.sport && (
                <p className="text-sm text-destructive">{form.formState.errors.sport.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                {...form.register("startDate")}
              />
              {form.formState.errors.startDate && (
                <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                {...form.register("startTime")}
              />
              {form.formState.errors.startTime && (
                <p className="text-sm text-destructive">{form.formState.errors.startTime.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...form.register("location")}
                placeholder="Event location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Cost per Event</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                {...form.register("cost")}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Recurrence Pattern */}
          <div className="space-y-4">
            <Label>Recurrence Pattern</Label>
            <RadioGroup 
              defaultValue="none" 
              onValueChange={(value) => form.setValue("recurrence", value)}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none">One-time</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly">Weekly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="monthly" />
                <Label htmlFor="monthly">Monthly</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom">Custom</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Team Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Primary Team *</Label>
              <Select onValueChange={(value) => form.setValue("primaryTeamId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select primary team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team: any) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.primaryTeamId && (
                <p className="text-sm text-destructive">{form.formState.errors.primaryTeamId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Additional Teams</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team: any) => (
                  <div key={team.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                    <Checkbox
                      checked={selectedTeams.includes(team.id)}
                      onCheckedChange={() => toggleTeamSelection(team.id)}
                    />
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <i className="fas fa-users text-white text-sm"></i>
                      </div>
                      <span className="text-sm font-medium">{team.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Requirements */}
          <div className="space-y-2">
            <Label htmlFor="requirements">Equipment/Venue Requirements</Label>
            <Textarea
              id="requirements"
              {...form.register("requirements")}
              placeholder="e.g., Football field, goals"
            />
          </div>

          {/* Publishing Options */}
          <div className="space-y-4">
            <Label>Publishing Options</Label>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={form.watch("isPublished")}
                  onCheckedChange={(checked) => form.setValue("isPublished", !!checked)}
                />
                <Label>Publish immediately</Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={form.watch("enableVoting")}
                  onCheckedChange={(checked) => form.setValue("enableVoting", !!checked)}
                />
                <Label>Enable team voting for participation</Label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              className="flex-1"
              disabled={createEventMutation.isPending}
            >
              Save as Draft
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={onCancel}
              disabled={createEventMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
