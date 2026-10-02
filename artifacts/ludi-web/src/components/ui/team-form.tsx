import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

import { SPORTS } from "@workspace/db/schema";

// Use the shared sports options
const SPORTS_OPTIONS = [...SPORTS];

// Multi-select component for sports
function SportsMultiSelect({ 
  value, 
  onChange, 
  placeholder = "Select sports..." 
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const [selectedSports, setSelectedSports] = useState<string[]>(value);
  const [isOpen, setIsOpen] = useState(false);

  const toggleSport = (sport: string) => {
    const newSelection = selectedSports.includes(sport)
      ? selectedSports.filter(s => s !== sport)
      : [...selectedSports, sport];
    
    setSelectedSports(newSelection);
    onChange(newSelection);
  };

  const removeSport = (sport: string) => {
    const newSelection = selectedSports.filter(s => s !== sport);
    setSelectedSports(newSelection);
    onChange(newSelection);
  };

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between"
          >
            {selectedSports.length === 0 ? placeholder : `${selectedSports.length} sport${selectedSports.length !== 1 ? 's' : ''} selected`}
            <svg
              className="ml-2 h-4 w-4 shrink-0 opacity-50"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <div className="max-h-60 overflow-auto">
            {SPORTS_OPTIONS.map(sport => (
              <div
                key={sport}
                className="flex items-center space-x-2 p-2 hover:bg-accent cursor-pointer"
                onClick={() => toggleSport(sport)}
              >
                <Checkbox
                  checked={selectedSports.includes(sport)}
                />
                <span className="flex-1">{sport}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      
      {selectedSports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSports.map(sport => (
            <Badge 
              key={sport} 
              variant="secondary" 
              className="cursor-pointer"
              onClick={() => removeSport(sport)}
            >
              {sport}
              <i className="fas fa-times ml-1"></i>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

const teamFormSchema = z.object({
  name: z.string().min(1, "Team name is required").max(30, "Team name must be 30 characters or less"),
  description: z.string().optional(),
  sports: z.array(z.string()).min(1, "At least one sport must be selected"),
  color: z.string().default("#3b82f6"),
  gender: z.enum(["male", "female", "mixed"]).default("mixed"),
  maxPlayers: z.string().optional(),
  isPrivate: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
});

type TeamFormData = z.infer<typeof teamFormSchema>;

interface TeamFormProps {
  onCancel: () => void;
  onSuccess: () => void;
  teamId?: string; // For editing existing teams
}

export default function TeamForm({ onCancel, onSuccess, teamId }: TeamFormProps) {
  const { toast } = useToast();
  const isEditing = !!teamId;

  const form = useForm<z.input<typeof teamFormSchema>, unknown, TeamFormData>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: "",
      description: "",
      sports: [],
      color: "#3b82f6",
      gender: "mixed",
      maxPlayers: "",
      isPrivate: false,
      requiresApproval: true,
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      // Convert string maxPlayers to number or null for "No limit"
      const processedData = {
        ...data,
        maxPlayers: data.maxPlayers && data.maxPlayers !== "" && data.maxPlayers !== "0" ? parseInt(data.maxPlayers) : null,
      };
      
      const url = isEditing ? `/api/teams/${teamId}` : "/api/teams";
      const method = isEditing ? "PUT" : "POST";
      return apiRequest(method, url, processedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "Success",
        description: `Team ${isEditing ? "updated" : "created"} successfully`,
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
      let errorMessage = `Failed to ${isEditing ? "update" : "create"} team`;
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

  const onSubmit = (data: TeamFormData) => {
    createTeamMutation.mutate(data);
  };



  const colorOptions = [
    { name: "Blue", value: "#3b82f6" },
    { name: "Red", value: "#ef4444" },
    { name: "Green", value: "#22c55e" },
    { name: "Purple", value: "#a855f7" },
    { name: "Orange", value: "#f97316" },
    { name: "Pink", value: "#ec4899" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Yellow", value: "#eab308" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Team" : "Create New Team"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Team Name * (max 30 characters)</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Enter team name"
                  maxLength={30}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="sports">Sports *</Label>
                <SportsMultiSelect
                  value={form.watch("sports")}
                  onChange={(value) => form.setValue("sports", value)}
                  placeholder="Select sports..."
                />
                {form.formState.errors.sports && (
                  <p className="text-sm text-red-500 mt-1">
                    {form.formState.errors.sports.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Enter team description"
                  rows={4}
                />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="color">Team Color</Label>
                <Select
                  value={form.watch("color")}
                  onValueChange={(value) => form.setValue("color", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team color" />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: color.value }}
                          ></div>
                          <span>{color.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="maxPlayers">Maximum Players</Label>
                <Input
                  id="maxPlayers"
                  type="number"
                  min="1"
                  {...form.register("maxPlayers")}
                  placeholder="Leave empty for no limit"
                />
                <p className="text-xs text-neutral-500 mt-1">Leave empty for unlimited members</p>
              </div>

              <div>
                <Label htmlFor="gender">Team Gender Preference</Label>
                <Select
                  value={form.watch("gender")}
                  onValueChange={(value) => form.setValue("gender", value as "male" | "female" | "mixed")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male Only</SelectItem>
                    <SelectItem value="female">Female Only</SelectItem>
                    <SelectItem value="mixed">Mixed Gender</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500 mt-1">For safety in sports competitions</p>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="isPrivate">Private Team</Label>
                    <p className="text-sm text-neutral-500">
                      Only invited members can join
                    </p>
                  </div>
                  <Switch
                    id="isPrivate"
                    checked={form.watch("isPrivate")}
                    onCheckedChange={(checked) => form.setValue("isPrivate", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requiresApproval">Requires Approval</Label>
                    <p className="text-sm text-neutral-500">
                      New members need approval to join
                    </p>
                  </div>
                  <Switch
                    id="requiresApproval"
                    checked={form.watch("requiresApproval")}
                    onCheckedChange={(checked) => form.setValue("requiresApproval", checked)}
                  />
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
              disabled={createTeamMutation.isPending}
              className="min-w-32"
            >
              {createTeamMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>{isEditing ? "Updating..." : "Creating..."}</span>
                </div>
              ) : (
                isEditing ? "Update Team" : "Create Team"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}