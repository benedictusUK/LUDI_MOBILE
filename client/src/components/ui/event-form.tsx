import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SPORTS } from "@shared/schema";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

// Form validation schema
const eventFormSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  sport: z.string().min(1, "Sport is required"),
  location: z.string().min(1, "Location is required"),
  address: z.string().optional(),
  postcode: z.string().optional(),
  gender: z.enum(["male", "female", "mixed"]),
  requirements: z.string().min(1, "Description is required"),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  primaryTeamId: z.string().min(1, "Primary team is required"),
  secondaryTeamIds: z.array(z.string()).optional(),
  maxParticipants: z.coerce.number().optional(),
  cost: z.coerce.number().optional(),
  isPublished: z.boolean().default(true),
  requiresPayment: z.boolean().default(false),
});

type EventFormData = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  isEditing?: boolean;
  initialData?: any;
  teams?: any[];
  onCancel: () => void;
  eventId?: string;
}

export function EventForm({ isEditing = false, initialData, teams = [], onCancel, eventId }: EventFormProps) {
  const { toast } = useToast();
  
  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: isEditing && initialData ? {
      name: initialData.name || "",
      sport: initialData.sport || "",
      location: initialData.location || "",
      address: initialData.address || "",
      postcode: initialData.postcode || "",
      gender: initialData.gender || "mixed",
      requirements: initialData.requirements || "",
      startDate: initialData.startDate || "",
      startTime: initialData.startTime || "",
      endDate: initialData.endDate || "",
      endTime: initialData.endTime || "",
      primaryTeamId: initialData.primaryTeamId || "",
      secondaryTeamIds: initialData.secondaryTeamIds || [],
      maxParticipants: initialData.maxParticipants || undefined,
      cost: initialData.cost || undefined,
      isPublished: initialData.isPublished ?? true,
      requiresPayment: initialData.requiresPayment ?? false,
    } : {
      name: "",
      sport: "",
      location: "",
      address: "",
      postcode: "",
      gender: "mixed",
      requirements: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      primaryTeamId: "",
      secondaryTeamIds: [],
      maxParticipants: undefined,
      cost: undefined,
      isPublished: true,
      requiresPayment: false,
    },
  });

  // Reset form with initial data when editing
  useEffect(() => {
    if (isEditing && initialData) {
      console.log("Setting form data:", initialData);
      // Use setTimeout to ensure Select components are properly rendered
      setTimeout(() => {
        const formData = {
          name: initialData.name || "",
          sport: initialData.sport || "",
          location: initialData.location || "",
          address: initialData.address || "",
          postcode: initialData.postcode || "",
          gender: initialData.gender || "mixed",
          requirements: initialData.requirements || "",
          startDate: initialData.startDate || "",
          startTime: initialData.startTime || "",
          endDate: initialData.endDate || "",
          endTime: initialData.endTime || "",
          primaryTeamId: initialData.primaryTeamId || "",
          secondaryTeamIds: initialData.secondaryTeamIds || [],
          maxParticipants: initialData.maxParticipants || undefined,
          cost: initialData.cost || undefined,
          isPublished: initialData.isPublished ?? true,
          requiresPayment: initialData.requiresPayment ?? false,
        };
        console.log("Resetting form with:", formData);
        form.reset(formData);
        
        // Force update individual fields to ensure they're set
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== undefined && value !== "") {
            form.setValue(key as any, value);
          }
        });
      }, 200);
    }
  }, [isEditing, initialData, form]);

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const endpoint = isEditing ? `/api/events/${eventId}` : "/api/events";
      const method = isEditing ? "PATCH" : "POST";
      if (isEditing) {
        return fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }).then(res => res.json());
      } else {
        return apiRequest(endpoint, {
          method,
          body: data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      }
      
      toast({
        title: "Success",
        description: `Event ${isEditing ? "updated" : "created"} successfully!`,
      });
      onCancel();
    },
    onError: (error: any) => {
      let errorMessage = `Failed to ${isEditing ? "update" : "create"} event. Please try again.`;
      
      try {
        if (error.message) {
          const parsed = JSON.parse(error.message);
          errorMessage = parsed.message || errorMessage;
        }
      } catch (e) {
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

  const sportOptions = [...SPORTS];

  // Early return with loading state if teams is still loading (but allow empty teams array)
  if (teams === undefined || teams === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Event" : "Create New Event"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading teams...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Event" : "Create New Event"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
              <TabsTrigger value="datetime">Date & Time</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="gender">Event Gender *</Label>
                  <Select
                    value={form.watch("gender")}
                    onValueChange={(value: "male" | "female" | "mixed") => form.setValue("gender", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender requirement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male Only</SelectItem>
                      <SelectItem value="female">Female Only</SelectItem>
                      <SelectItem value="mixed">Mixed Gender</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.gender && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.gender.message}
                    </p>
                  )}
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
                      {(teams || []).map((team: any) => (
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
            </TabsContent>

            {/* Location Tab */}
            <TabsContent value="location" className="space-y-4 mt-6">
              <div>
                <Label htmlFor="location">Venue/Location *</Label>
                <Input
                  id="location"
                  {...form.register("location")}
                  placeholder="e.g., Central Park Tennis Courts"
                />
                {form.formState.errors.location && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.location.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="address">Full Address (for Flare Gun radius)</Label>
                  <Input
                    id="address"
                    {...form.register("address")}
                    placeholder="123 Main Street, City"
                  />
                  {form.formState.errors.address && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.address.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    {...form.register("postcode")}
                    placeholder="SW1A 1AA"
                  />
                  {form.formState.errors.postcode && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.postcode.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Flare Gun Feature:</strong> Adding an address and postcode enables the flare gun to find nearby players within a reasonable travel radius.
                </p>
              </div>
            </TabsContent>

            {/* Date & Time Tab */}
            <TabsContent value="datetime" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Input
                    id="startTime"
                    type="text"
                    pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                    placeholder="HH:MM"
                    value={form.watch("startTime") || ""}
                    onChange={(e) => {
                      let input = e.target.value.replace(/[^\d]/g, '');
                      if (input.length >= 2) {
                        input = input.slice(0, 2) + ':' + input.slice(2, 4);
                      }
                      if (input.length > 5) {
                        input = input.slice(0, 5);
                      }
                      form.setValue("startTime", input);
                    }}
                    maxLength={5}
                    required
                  />
                  {form.formState.errors.startTime && (
                    <p className="text-sm text-red-500 mt-1">
                      {form.formState.errors.startTime.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="endDate">End Date (optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    {...form.register("endDate")}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time (optional)</Label>
                  <Input
                    id="endTime"
                    type="text"
                    pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                    placeholder="HH:MM"
                    value={form.watch("endTime") || ""}
                    onChange={(e) => {
                      let input = e.target.value.replace(/[^\d]/g, '');
                      if (input.length >= 2) {
                        input = input.slice(0, 2) + ':' + input.slice(2, 4);
                      }
                      if (input.length > 5) {
                        input = input.slice(0, 5);
                      }
                      form.setValue("endTime", input);
                    }}
                    maxLength={5}
                  />
                </div>
              </div>

              {/* Recurring Events Section - Placeholder for future development */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Recurring Events</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Weekly, monthly, and custom recurring events coming soon!
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    step="0.01"
                    min="0"
                    {...form.register("cost")}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondaryTeamIds">Additional Teams (Optional)</Label>
                <div className="relative">
                  <Select
                    onValueChange={(value) => {
                      const currentSecondary = form.watch("secondaryTeamIds") || [];
                      if (!currentSecondary.includes(value)) {
                        form.setValue("secondaryTeamIds", [...currentSecondary, value]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add additional teams..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(teams || [])
                        .filter((team: any) => 
                          team.id !== form.watch("primaryTeamId") && 
                          !form.watch("secondaryTeamIds")?.includes(team.id)
                        )
                        .map((team: any) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Display selected additional teams as removable tags */}
                  {form.watch("secondaryTeamIds") && form.watch("secondaryTeamIds")!.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.watch("secondaryTeamIds")!.map((teamId: string) => {
                        const team = (teams || []).find((t: any) => t.id === teamId);
                        return team ? (
                          <div
                            key={teamId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                          >
                            <span>{team.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const currentSecondary = form.watch("secondaryTeamIds") || [];
                                form.setValue("secondaryTeamIds", currentSecondary.filter(id => id !== teamId));
                              }}
                              className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isPublished"
                  checked={form.watch("isPublished")}
                  onCheckedChange={(checked) => form.setValue("isPublished", checked)}
                />
                <Label htmlFor="isPublished">Publish Event</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="requiresPayment"
                  checked={form.watch("requiresPayment")}
                  onCheckedChange={(checked) => form.setValue("requiresPayment", checked)}
                />
                <Label htmlFor="requiresPayment">Requires Payment</Label>
              </div>
            </TabsContent>
          </Tabs>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={createEventMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending
                ? (isEditing ? "Updating..." : "Creating...")
                : (isEditing ? "Update Event" : "Create Event")
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default EventForm;