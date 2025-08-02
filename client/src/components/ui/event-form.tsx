
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

// Custom Time Input Component with auto-colon insertion
function TimeInput({ 
  value, 
  onChange, 
  placeholder = "HH:MM", 
  required = false,
  ...props 
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  [key: string]: any;
}) {
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/[^\d]/g, ''); // Remove non-digits
    
    if (input.length >= 2) {
      // Auto-insert colon after 2 digits
      input = input.slice(0, 2) + ':' + input.slice(2, 4);
    }
    
    // Limit to HH:MM format (5 characters max)
    if (input.length > 5) {
      input = input.slice(0, 5);
    }
    
    onChange(input);
  };

  return (
    <Input
      type="text"
      pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
      placeholder={placeholder}
      inputMode="numeric"
      value={value}
      onChange={handleTimeChange}
      maxLength={5}
      {...props}
    />
  );
}

const eventFormSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  requirements: z.string().min(1, "Description is required"),
  sport: z.string().min(1, "Sport is required"),
  location: z.string().min(1, "Location is required"),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  primaryTeamId: z.string().min(1, "Primary team is required"),
  secondaryTeamIds: z.array(z.string()).optional().default([]),
  maxParticipants: z.string().optional(),
  cost: z.string().optional(),
  isPublished: z.boolean().default(false),
  requiresPayment: z.boolean().default(false),
});

type EventFormData = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  onCancel: () => void;
  onSuccess: () => void;
  eventId?: string; // For editing existing events
}

export default function EventForm({ onCancel, onSuccess, eventId }: EventFormProps) {
  const { toast } = useToast();
  const isEditing = !!eventId;

  // Fetch teams for selection
  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
  });

  // Fetch existing event data if editing
  const { data: existingEvent } = useQuery({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: "",
      requirements: "",
      sport: "",
      location: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      primaryTeamId: "",
      secondaryTeamIds: [],
      maxParticipants: "",
      cost: "",
      isPublished: false,
      requiresPayment: false,
    },
  });

  // Update form values when existing event data loads
  useEffect(() => {
    if (existingEvent && typeof existingEvent === 'object') {
      const event = existingEvent as any;
      form.reset({
        name: event.name || "",
        requirements: event.requirements || "",
        sport: event.sport || "",
        location: event.location || "",
        startDate: event.startDate || "",
        startTime: event.startTime || "",
        endDate: event.endDate || "",
        endTime: event.endTime || "",
        primaryTeamId: event.primaryTeamId || "",
        secondaryTeamIds: event.secondaryTeamIds || [],
        maxParticipants: event.maxParticipants?.toString() || "",
        cost: event.cost || "",
        isPublished: event.isPublished || false,
        requiresPayment: event.requiresPayment || false,
      });
    }
  }, [existingEvent, form]);

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      // Convert string fields to appropriate types for backend
      const processedData = {
        ...data,
        cost: data.cost || "0.00",
        maxParticipants: data.maxParticipants ? parseInt(data.maxParticipants) : null,
        // Convert empty strings to null for optional fields
        endDate: data.endDate || null,
        endTime: data.endTime || null,
        secondaryTeamIds: data.secondaryTeamIds || [],
      };
      
      const url = isEditing ? `/api/events/${eventId}` : "/api/events";
      const method = isEditing ? "PUT" : "POST";
      return apiRequest(method, url, processedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Success",
        description: `Event ${isEditing ? "updated" : "created"} successfully`,
      });
      onSuccess();
    },
    onError: (error: any) => {
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

      // Parse error message for detailed feedback
      let errorMessage = `Failed to ${isEditing ? "update" : "create"} event`;
      try {
        const errorData = JSON.parse(error.message.split(': ')[1] || '{}');
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // If parsing fails, check if it's a simple error message
        if (error.message && error.message.includes(':')) {
          const parts = error.message.split(': ');
          if (parts.length > 1) {
            errorMessage = parts[1];
          }
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EventFormData) => {
    createEventMutation.mutate(data);
  };

  const sportOptions = [
    "Football", "Basketball", "Soccer", "Baseball", "Tennis", "Golf", 
    "Swimming", "Running", "Cycling", "Volleyball", "Hockey", "Rugby"
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Event" : "Create New Event"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Enter event name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="sport">Sport *</Label>
                <Select
                  value={form.watch("sport")}
                  onValueChange={(value) => form.setValue("sport", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {sportOptions.map((sport) => (
                      <SelectItem key={sport} value={sport}>
                        {sport}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.sport && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.sport.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  {...form.register("location")}
                  placeholder="Enter event location"
                />
                {form.formState.errors.location && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.location.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="requirements">Description *</Label>
                <Textarea
                  id="requirements"
                  {...form.register("requirements")}
                  placeholder="Enter event description"
                  rows={3}
                />
                {form.formState.errors.requirements && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.requirements.message}
                  </p>
                )}
              </div>
            </div>

            {/* Date, Time & Settings */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...form.register("startDate")}
                  />
                  {form.formState.errors.startDate && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.startDate.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="startTime">Start Time * (24h)</Label>
                  <TimeInput
                    id="startTime"
                    value={form.watch("startTime") || ""}
                    onChange={(value) => form.setValue("startTime", value)}
                    placeholder="HH:MM"
                    required
                  />
                  {form.formState.errors.startTime && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.startTime.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    {...form.register("endDate")}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time (24h)</Label>
                  <TimeInput
                    id="endTime"
                    value={form.watch("endTime") || ""}
                    onChange={(value) => form.setValue("endTime", value)}
                    placeholder="HH:MM"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="primaryTeamId">Primary Team *</Label>
                <Select
                  value={form.watch("primaryTeamId")}
                  onValueChange={(value) => form.setValue("primaryTeamId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select primary team" />
                  </SelectTrigger>
                  <SelectContent>
                    {(teams as any[]).map((team: any) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.primaryTeamId && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.primaryTeamId.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="secondaryTeamIds">Secondary Teams (Optional)</Label>
                <div className="space-y-2">
                  {(teams as any[])
                    .filter((team: any) => team.id !== form.watch("primaryTeamId"))
                    .map((team: any) => (
                      <div key={team.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`secondary-${team.id}`}
                          checked={form.watch("secondaryTeamIds")?.includes(team.id) || false}
                          onChange={(e) => {
                            const currentSecondary = form.watch("secondaryTeamIds") || [];
                            if (e.target.checked) {
                              form.setValue("secondaryTeamIds", [...currentSecondary, team.id]);
                            } else {
                              form.setValue("secondaryTeamIds", currentSecondary.filter(id => id !== team.id));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <Label 
                          htmlFor={`secondary-${team.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {team.name}
                        </Label>
                      </div>
                    ))}
                  {(teams as any[]).filter((team: any) => team.id !== form.watch("primaryTeamId")).length === 0 && (
                    <p className="text-sm text-gray-500">No additional teams available</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxParticipants">Max Participants</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    min="1"
                    {...form.register("maxParticipants")}
                    placeholder="No limit"
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Event Cost (£)</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    {...form.register("cost")}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requiresPayment"
                    checked={form.watch("requiresPayment")}
                    onCheckedChange={(checked) => form.setValue("requiresPayment", checked)}
                  />
                  <Label htmlFor="requiresPayment">Requires Payment</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPublished"
                    checked={form.watch("isPublished")}
                    onCheckedChange={(checked) => form.setValue("isPublished", checked)}
                  />
                  <Label htmlFor="isPublished">Publish Event</Label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createEventMutation.isPending}
              className="min-w-32"
            >
              {createEventMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>{isEditing ? "Updating..." : "Creating..."}</span>
                </div>
              ) : (
                isEditing ? "Update Event" : "Create Event"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}