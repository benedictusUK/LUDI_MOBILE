import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const teamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  sport: z.string().min(1, "Sport is required"),
  maxPlayers: z.number().min(1).max(100).optional(),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export default function TeamForm({ onCancel, onSuccess }: TeamFormProps) {
  const { toast } = useToast();

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      sport: "",
      maxPlayers: 30,
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      await apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Team created successfully",
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
        description: "Failed to create team",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TeamFormData) => {
    createTeamMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Team</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="Enter team name"
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
              <Label htmlFor="maxPlayers">Max Players</Label>
              <Input
                id="maxPlayers"
                type="number"
                min="1"
                max="100"
                {...form.register("maxPlayers", { valueAsNumber: true })}
                placeholder="30"
              />
            </div>
          </div>

          <div className="flex space-x-4">
            <Button 
              type="submit" 
              disabled={createTeamMutation.isPending}
            >
              {createTeamMutation.isPending ? "Creating..." : "Create Team"}
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={onCancel}
              disabled={createTeamMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
