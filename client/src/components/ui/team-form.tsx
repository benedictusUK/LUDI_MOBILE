import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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

const teamFormSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
  sport: z.string().min(1, "Sport is required"),
  color: z.string().default("#3b82f6"),
  maxMembers: z.number().min(1).optional(),
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

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: "",
      description: "",
      sport: "",
      color: "#3b82f6",
      maxMembers: undefined,
      isPrivate: false,
      requiresApproval: true,
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      const url = isEditing ? `/api/teams/${teamId}` : "/api/teams";
      const method = isEditing ? "PUT" : "POST";
      return apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "Success",
        description: `Team ${isEditing ? "updated" : "created"} successfully`,
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
        description: `Failed to ${isEditing ? "update" : "create"} team`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TeamFormData) => {
    createTeamMutation.mutate(data);
  };

  const sportOptions = [
    "Football", "Basketball", "Soccer", "Baseball", "Tennis", "Golf", 
    "Swimming", "Running", "Cycling", "Volleyball", "Hockey", "Rugby"
  ];

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
                <Label htmlFor="name">Team Name *</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Enter team name"
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
                <Label htmlFor="maxMembers">Maximum Members</Label>
                <Input
                  id="maxMembers"
                  type="number"
                  min="1"
                  {...form.register("maxMembers", { valueAsNumber: true })}
                  placeholder="No limit"
                />
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