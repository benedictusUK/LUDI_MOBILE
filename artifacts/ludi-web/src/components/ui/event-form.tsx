
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, type InputHTMLAttributes } from "react";
import { useAuth } from "@/hooks/useAuth";
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
import { apiErrorMessage } from "@/lib/apiError";
import { isUnauthorizedError } from "@/lib/authUtils";
import { SPORTS, type PlatformCharge, type Event, type Team } from "@workspace/db/schema";
import type { TeamMember } from "@/types";
import { calculateTotalAmount } from "@/lib/payment-utils";

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
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">) {
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

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v?: string) => (v ? new Date(v).toISOString() : null);
const poundsToPence = (v?: string) => Math.round(parseFloat(v || "0") * 100);

const eventFormSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  requirements: z.string().min(1, "Description is required"),
  sport: z.string().min(1, "Sport is required"),
  location: z.string().min(1, "Location is required").max(30, "Location must be 30 characters or less"),
  address: z.string().optional().or(z.literal("")),
  postcode: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "mixed"]),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().optional().or(z.literal("")),
  endTime: z.string().optional().or(z.literal("")),
  primaryTeamId: z.string().min(1, "Primary team is required"),
  secondaryTeamIds: z.array(z.string()),
  maxParticipants: z.string().optional(),
  reserveSpots: z.string().optional(),
  cost: z.string().optional(),
  isPublished: z.boolean(),
  requiresPayment: z.boolean(),
  maxPlayerPayment: z.string().optional(),
  finalVenueCost: z.string().optional(),
  paymentPolicy: z.enum(["fixed_immediate", "fixed_threshold", "flexible_post_event"]),
  fixedPrice: z.string().optional(),
  minimumPaidParticipants: z.string().optional(),
  paymentDeadline: z.string().optional(),
  authorizationOpensAt: z.string().optional(),
  completionDueAt: z.string().optional(),
  venueOrganiserId: z.string().optional(),
  // Recurring events fields
  recurrenceType: z.enum(["none", "daily", "weekly", "monthly"]),
  recurrenceDaysOfWeek: z.array(z.string()),
  recurrenceEndDate: z.string().optional().or(z.literal("")),
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
  const { user } = useAuth();

  // Fetch teams for selection
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  // Fetch existing event data if editing
  const { data: existingEvent } = useQuery<Event>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  // Fetch platform charges for payment calculation
  const { data: platformCharges = [] } = useQuery<PlatformCharge[]>({
    queryKey: ["/api/platform-charges"],
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: "",
      requirements: "",
      sport: "",
      location: "",
      address: "",
      postcode: "",
      gender: "mixed",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      primaryTeamId: "",
      secondaryTeamIds: [],
      maxParticipants: "",
      reserveSpots: "",
      cost: "",
      isPublished: false,
      requiresPayment: false,
      maxPlayerPayment: "",
      finalVenueCost: "",
      paymentPolicy: "flexible_post_event",
      fixedPrice: "",
      minimumPaidParticipants: "",
      paymentDeadline: "",
      authorizationOpensAt: "",
      completionDueAt: "",
      venueOrganiserId: "",
      recurrenceType: "none",
      recurrenceDaysOfWeek: [],
    recurrenceEndDate: "",
    },
  });

  const requiresPayment = form.watch("requiresPayment");
  const primaryTeamId = form.watch("primaryTeamId");

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/teams", primaryTeamId, "members"],
    enabled: requiresPayment && !!primaryTeamId,
  });

  const maxPlayerPayment = form.watch("maxPlayerPayment");
  const paymentCalculation = calculateTotalAmount(maxPlayerPayment || "0", platformCharges);

  useEffect(() => {
    if (user && (!form.getValues("venueOrganiserId") || form.getValues("venueOrganiserId") === "")) {
      form.setValue("venueOrganiserId", (user as any).id);
    }
  }, [user, form]);

  useEffect(() => {
    if (requiresPayment && user && !form.getValues("venueOrganiserId")) {
      form.setValue("venueOrganiserId", (user as any).id);
    }
  }, [requiresPayment, user, form]);

  // Update form values when existing event data loads
  useEffect(() => {
    if (existingEvent && typeof existingEvent === "object") {
      const event = existingEvent;
      
      // Use setTimeout to ensure the form is ready before resetting
      setTimeout(() => {
        form.reset({
          name: event.name || "",
          requirements: event.requirements || "",
          sport: event.sport || "",
          location: event.location || "",
          address: event.address || "",
          postcode: event.postcode || "",
          gender: event.gender || "mixed",
          startDate: event.startDate || "",
          startTime: event.startTime || "",
          endDate: event.endDate || "",
          endTime: event.endTime || "",
          primaryTeamId: event.primaryTeamId || "",
          secondaryTeamIds: event.secondaryTeamIds || [],
          maxParticipants: (event as any).participants?.toString() || "",
          reserveSpots: event.reserveSpots?.toString() || "",
          cost: event.cost || "",
        isPublished: event.isPublished || false,
        requiresPayment: event.paymentRequired || false,
        maxPlayerPayment: event.maxPlayerPayment || "",
        finalVenueCost: (event as any).finalVenueCost?.toString() || "",
        paymentPolicy: ((event as any).paymentPolicy && (event as any).paymentPolicy !== "none" ? (event as any).paymentPolicy : "flexible_post_event"),
        fixedPrice: (event as any).fixedPriceMinor != null ? ((event as any).fixedPriceMinor / 100).toFixed(2) : "",
        minimumPaidParticipants: (event as any).minimumPaidParticipants?.toString() || "",
        paymentDeadline: toLocalInput((event as any).paymentDeadlineAt),
        authorizationOpensAt: toLocalInput((event as any).authorizationOpensAt),
        completionDueAt: toLocalInput((event as any).completionDueAt),
        venueOrganiserId: event.venueOrganiserId || event.createdById || "",
        recurrenceType: event.recurrenceType || "none",
          recurrenceDaysOfWeek: event.recurrenceDaysOfWeek || [],
          recurrenceEndDate: event.recurrenceEndDate || "",
        });
        
        // Force update critical Select fields
        form.setValue("sport", event.sport || "");
        form.setValue("gender", event.gender || "mixed");
        form.setValue("primaryTeamId", event.primaryTeamId || "");
      }, 100);
    }
  }, [existingEvent, form]);

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      // Convert string fields to appropriate types for backend
      const {
        requiresPayment, maxPlayerPayment, finalVenueCost, paymentPolicy, fixedPrice,
        minimumPaidParticipants, paymentDeadline, authorizationOpensAt, completionDueAt,
        maxParticipants, ...rest
      } = data;
      const isFixed = paymentPolicy === "fixed_immediate" || paymentPolicy === "fixed_threshold";
      const paymentFields: Record<string, unknown> = requiresPayment
        ? isFixed
          ? {
              paymentRequired: true,
              paymentPolicy,
              currency: "gbp",
              fixedPriceMinor: poundsToPence(fixedPrice),
              maxPlayerPayment: (poundsToPence(fixedPrice) / 100).toFixed(2),
              minimumPaidParticipants: paymentPolicy === "fixed_threshold" ? parseInt(minimumPaidParticipants || "0") : null,
              paymentDeadlineAt: fromLocalInput(paymentDeadline),
              authorizationOpensAt: fromLocalInput(authorizationOpensAt),
              completionDueAt: null,
              finalVenueCost: null,
            }
          : {
              paymentRequired: true,
              paymentPolicy,
              currency: "gbp",
              maxPlayerPayment: maxPlayerPayment || null,
              finalVenueCost: finalVenueCost || null,
              fixedPriceMinor: null,
              minimumPaidParticipants: null,
              paymentDeadlineAt: null,
              authorizationOpensAt: fromLocalInput(authorizationOpensAt),
              completionDueAt: fromLocalInput(completionDueAt),
            }
        : { paymentRequired: false, paymentPolicy: "none", fixedPriceMinor: null, minimumPaidParticipants: null, paymentDeadlineAt: null, authorizationOpensAt: null, completionDueAt: null };
      const processedData = {
        ...rest,
        ...paymentFields,
        cost: data.cost || "0.00",
        venueOrganiserId: data.venueOrganiserId || null,
        participants: maxParticipants ? parseInt(maxParticipants) : null,
        reserveSpots: data.reserveSpots ? parseInt(data.reserveSpots) : 0,
        endDate: data.endDate || null,
        endTime: data.endTime || null,
        secondaryTeamIds: data.secondaryTeamIds || [],
      };
      
      if (isEditing) {
        // For editing, use regular update endpoint
        return apiRequest("PUT", `/api/events/${eventId}`, processedData);
      } else {
        // For creating, use recurring or regular endpoint based on recurrence type
        const url = data.recurrenceType !== "none" ? "/api/events/recurring" : "/api/events";
        return apiRequest("POST", url, processedData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "payment-policy"] });
        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "payment-status"] });
      }
      toast({
        title: "Success",
        description: `Event ${isEditing ? "updated" : "created"} successfully`,
      });
      onSuccess();
    },
    onError: (error: unknown) => {
      if (isUnauthorizedError(error as Error)) {
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

      const errorMessage = apiErrorMessage(error, `Failed to ${isEditing ? "update" : "create"} event`);

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EventFormData) => {
    if (data.requiresPayment && !data.venueOrganiserId) {
      toast({
        title: "Venue Organiser Required",
        description: "Please select a venue organiser",
        variant: "destructive",
      });
      return;
    }
    if (data.requiresPayment) {
      const fail = (description: string) => toast({ title: "Payment settings", description, variant: "destructive" });
      const mode = data.paymentPolicy;
      const start = new Date(`${data.startDate}T${data.startTime}`);
      const end = new Date(`${data.endDate || data.startDate}T${data.endTime || data.startTime}`);
      const opens = data.authorizationOpensAt ? new Date(data.authorizationOpensAt) : null;
      if (mode === "flexible_post_event") {
        if (!(parseFloat(data.maxPlayerPayment || "0") > 0)) return void fail("Max player payment must be greater than 0");
        if (data.completionDueAt) {
          const due = new Date(data.completionDueAt);
          if (due <= end) return void fail("Completion due must be after the event ends");
          if (opens && due.getTime() - opens.getTime() > 5 * 86400000) return void fail("Completion due must be within 5 days of the authorization opening");
        }
      } else {
        const pence = poundsToPence(data.fixedPrice);
        if (!Number.isSafeInteger(pence) || pence <= 0) return void fail("Fixed price must be a positive amount in pounds");
        const deadline = data.paymentDeadline ? new Date(data.paymentDeadline) : null;
        if (mode === "fixed_threshold") {
          const min = parseInt(data.minimumPaidParticipants || "0");
          if (!Number.isInteger(min) || min < 1) return void fail("Minimum paid participants must be a positive whole number");
          if (data.maxParticipants && min > parseInt(data.maxParticipants)) return void fail("Minimum paid participants cannot exceed max players");
          if (!deadline) return void fail("Payment deadline is required");
        }
        if (deadline && deadline > start && mode === "fixed_threshold") return void fail("Payment deadline must be on or before the event start");
        if (opens && deadline && opens >= deadline) return void fail("Authorization opening must be before the payment deadline");
      }
    }
    createEventMutation.mutate(data);
  };

  const sportOptions = [...SPORTS];

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
                <Label htmlFor="location">Location * (max 30 characters)</Label>
                <Input
                  id="location"
                  {...form.register("location")}
                  placeholder="Enter event location"
                  maxLength={30}
                />
                {form.formState.errors.location && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.location.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="address">Address (for Flare Gun radius)</Label>
                <Input
                  id="address"
                  {...form.register("address")}
                  placeholder="Enter full address"
                />
                {form.formState.errors.address && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.address.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="postcode">Postcode (for Flare Gun radius)</Label>
                <Input
                  id="postcode"
                  {...form.register("postcode")}
                  placeholder="Enter postcode"
                />
                {form.formState.errors.postcode && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.postcode.message}
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
                    {teams.map((team) => (
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
                      <SelectValue placeholder="Add secondary teams..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teams
                        .filter(
                          (team) =>
                            team.id !== form.watch("primaryTeamId") &&
                            !form.watch("secondaryTeamIds")?.includes(team.id)
                        )
                        .map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Display selected secondary teams as removable tags */}
                  {form.watch("secondaryTeamIds") && form.watch("secondaryTeamIds").length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.watch("secondaryTeamIds").map((teamId: string) => {
                        const team = teams.find((t) => t.id === teamId);
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="maxParticipants">Max Players</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    min="1"
                    {...form.register("maxParticipants")}
                    placeholder="No limit"
                  />
                </div>
                <div>
                  <Label htmlFor="reserveSpots">Reserve Spots</Label>
                  <Input
                    id="reserveSpots"
                    type="number"
                    min="0"
                    {...form.register("reserveSpots")}
                    placeholder="0"
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

              {/* Recurring Events Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recurrenceType">Recurrence Pattern</Label>
                  <Select
                    value={form.watch("recurrenceType")}
                    onValueChange={(value: "none" | "daily" | "weekly" | "monthly") => 
                      form.setValue("recurrenceType", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recurrence pattern" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Recurrence</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.watch("recurrenceType") === "weekly" && (
                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex flex-wrap gap-2">
                      {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                        <div key={day} className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            id={day}
                            checked={form.watch("recurrenceDaysOfWeek").includes(day)}
                            onChange={(e) => {
                              const currentDays = form.watch("recurrenceDaysOfWeek");
                              if (e.target.checked) {
                                form.setValue("recurrenceDaysOfWeek", [...currentDays, day]);
                              } else {
                                form.setValue("recurrenceDaysOfWeek", currentDays.filter(d => d !== day));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={day} className="text-sm capitalize">{day.slice(0, 3)}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {form.watch("recurrenceType") !== "none" && (
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceEndDate">Recurrence End Date (Optional)</Label>
                    <Input
                      id="recurrenceEndDate"
                      type="date"
                      value={form.watch("recurrenceEndDate")}
                      onChange={(e) => form.setValue("recurrenceEndDate", e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
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

                {/* Max Player Payment field - only show when payment is required */}
                {form.watch("requiresPayment") && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <Label className="text-sm font-medium text-blue-800">Event Payment Settings</Label>
                      </div>
                      
                      <div>
                        <Label className="text-sm">Payment mode (GBP only)</Label>
                        <Select
                          value={form.watch("paymentPolicy")}
                          onValueChange={(v: any) => form.setValue("paymentPolicy", v)}
                        >
                          <SelectTrigger className="bg-white" data-testid="select-payment-policy"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flexible_post_event">Flexible - hold a cap, settle after event</SelectItem>
                            <SelectItem value="fixed_immediate">Fixed - charge price upfront</SelectItem>
                            <SelectItem value="fixed_threshold">Fixed with minimum - refunded if not enough pay</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-blue-600 mt-1">
                          {form.watch("paymentPolicy") === "flexible_post_event" && "Players authorise a cap, then are charged the actual cost after the event."}
                          {form.watch("paymentPolicy") === "fixed_immediate" && "Players are charged the displayed price when they join. Fees are deducted from this price, not added."}
                          {form.watch("paymentPolicy") === "fixed_threshold" && "Players are charged upfront and refunded if fewer than the minimum have paid by the deadline."}
                        </p>
                      </div>

                      {form.watch("paymentPolicy") !== "flexible_post_event" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="fixedPrice" className="text-sm">Fixed price per player (GBP)</Label>
                            <Input id="fixedPrice" type="number" min="0.01" step="0.01" {...form.register("fixedPrice")} placeholder="10.00" className="bg-white" data-testid="input-fixed-price" />
                            <p className="text-xs text-blue-600 mt-1">Players pay exactly this amount.</p>
                          </div>
                          {form.watch("paymentPolicy") === "fixed_threshold" && (
                            <div>
                              <Label htmlFor="minimumPaidParticipants" className="text-sm">Minimum paid players</Label>
                              <Input id="minimumPaidParticipants" type="number" min="1" step="1" {...form.register("minimumPaidParticipants")} className="bg-white" data-testid="input-min-paid" />
                            </div>
                          )}
                          <div>
                            <Label htmlFor="paymentDeadline" className="text-sm">
                              Payment deadline{form.watch("paymentPolicy") === "fixed_threshold" ? " *" : " (defaults to start)"}
                            </Label>
                            <Input id="paymentDeadline" type="datetime-local" {...form.register("paymentDeadline")} className="bg-white" />
                          </div>
                          <div>
                            <Label htmlFor="authorizationOpensAt" className="text-sm">Payments open (optional)</Label>
                            <Input id="authorizationOpensAt" type="datetime-local" {...form.register("authorizationOpensAt")} className="bg-white" />
                          </div>
                        </div>
                      ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="authorizationOpensAt" className="text-sm">Authorization opens (default 48h before)</Label>
                          <Input id="authorizationOpensAt" type="datetime-local" {...form.register("authorizationOpensAt")} className="bg-white" />
                        </div>
                        <div>
                          <Label htmlFor="completionDueAt" className="text-sm">Collect by (default end + 24h)</Label>
                          <Input id="completionDueAt" type="datetime-local" {...form.register("completionDueAt")} className="bg-white" />
                        </div>
                        <div>
                          <Label htmlFor="finalVenueCost" className="text-sm">Final venue cost (GBP, optional)</Label>
                          <Input id="finalVenueCost" type="number" min="0" step="0.01" {...form.register("finalVenueCost")} className="bg-white" />
                        </div>
                      </div>
                      )}

                      {form.watch("paymentPolicy") === "flexible_post_event" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="maxPlayerPayment" className="text-sm">Max Player Payment (GBP)</Label>
                          <Input
                            id="maxPlayerPayment"
                            type="number"
                            min="0"
                            step="0.01"
                            {...form.register("maxPlayerPayment")}
                            placeholder="25.00"
                            className="bg-white"
                            data-testid="input-max-player-payment"
                          />
                          <p className="text-xs text-blue-600 mt-1">
                            Base amount to charge each player
                          </p>
                        </div>

                        {/* Total Amount Calculation Display */}
                        {maxPlayerPayment && parseFloat(maxPlayerPayment) > 0 && (
                          <div className="bg-white p-3 rounded border">
                            <Label className="text-sm font-medium text-gray-700 mb-2 block">Total Amount Breakdown</Label>
                            <div className="space-y-1 text-xs">
                              {paymentCalculation.breakdown.map((item, index) => (
                                <div key={index} className={`flex justify-between ${
                                  item.type === 'base' ? 'font-medium' : 'text-gray-600'
                                }`}>
                                  <span>{item.name}</span>
                                  <span>£{item.amount.toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="border-t pt-1 mt-2 flex justify-between font-medium text-blue-700">
                                <span>Total per Player:</span>
                                <span data-testid="text-total-amount">£{paymentCalculation.total.toFixed(2)}</span>
                              </div>
                            </div>
                            <p className="text-xs text-blue-600 mt-2">
                              This total includes all platform charges and will be authorized when players vote to attend.
                            </p>
                          </div>
                        )}
                      </div>
                      )}
                      <div>
                        <Label htmlFor="venueOrganiserId" className="text-sm">Venue Organiser *</Label>
                        <Select
                          value={form.watch("venueOrganiserId")}
                          onValueChange={(value) => form.setValue("venueOrganiserId", value)}
                        >
                          <SelectTrigger id="venueOrganiserId" className="bg-white">
                            <SelectValue placeholder="Select organiser" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map(member => (
                              <SelectItem key={member.userId} value={member.userId}>
                                {member.user.firstName} {member.user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-blue-600 mt-1">
                          This member will manage the venue and won't need to pay to attend.
                        </p>
                      </div>

                      <p className="text-xs text-blue-600">
                        {form.watch("paymentPolicy") === "flexible_post_event"
                          ? "Players authorize the agreed cap when joining. The actual share is collected after the event."
                          : "Players pay the stated price when joining. There is no separate post-event collection."}
                      </p>
                    </div>
                  </div>
                )}
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