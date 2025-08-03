import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { profileCompletionSchema } from "@shared/schema";
import { CheckCircle, XCircle } from "lucide-react";

type ProfileCompletionData = z.infer<typeof profileCompletionSchema>;

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export function ProfileCompletionModal({ isOpen, onClose, user }: ProfileCompletionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [usernameAvailability, setUsernameAvailability] = useState<{ available: boolean; checked: boolean }>({
    available: false,
    checked: false,
  });

  const form = useForm<ProfileCompletionData>({
    resolver: zodResolver(profileCompletionSchema),
    defaultValues: {
      username: user?.username || "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
      postcode: user?.postcode || "",
      gender: user?.gender || "",
    },
  });

  const checkUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await apiRequest("GET", `/api/profile/check-username/${encodeURIComponent(username)}`);
      return response.json();
    },
    onSuccess: (data) => {
      setUsernameAvailability({ available: data.available, checked: true });
    },
  });

  const completeProfileMutation = useMutation({
    mutationFn: (data: ProfileCompletionData) =>
      apiRequest("POST", "/api/profile/complete", data),
    onSuccess: () => {
      toast({
        title: "Profile completed",
        description: "Welcome to LUDI! Your profile is now complete.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onClose();
    },
    onError: (error: any) => {
      if (error.errors) {
        error.errors.forEach((err: any) => {
          if (err.path.includes("username")) {
            form.setError("username", { message: err.message });
          } else if (err.path.includes("dateOfBirth")) {
            form.setError("dateOfBirth", { message: err.message });
          } else if (err.path.includes("postcode")) {
            form.setError("postcode", { message: err.message });
          }
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to complete profile",
        });
      }
    },
  });

  const watchedUsername = form.watch("username");

  React.useEffect(() => {
    if (watchedUsername && watchedUsername.length >= 3) {
      const timer = setTimeout(() => {
        checkUsernameMutation.mutate(watchedUsername);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameAvailability({ available: false, checked: false });
    }
  }, [watchedUsername]);

  const onSubmit = (data: ProfileCompletionData) => {
    if (!usernameAvailability.available && usernameAvailability.checked) {
      form.setError("username", { message: "Username is not available" });
      return;
    }
    completeProfileMutation.mutate(data);
  };

  const isProfileComplete = user?.username && user?.firstName && user?.lastName && user?.email && user?.phoneNumber && user?.dateOfBirth && user?.postcode && user?.gender;

  return (
    <Dialog open={isOpen && !isProfileComplete} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Please complete your profile to get started with LUDI. You must be at least 18 years old to use our platform.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input 
                        placeholder="Choose a unique username" 
                        {...field} 
                        className={
                          usernameAvailability.checked
                            ? usernameAvailability.available
                              ? "border-green-500"
                              : "border-red-500"
                            : ""
                        }
                      />
                    </FormControl>
                    {usernameAvailability.checked && (
                      <div className="absolute right-3 top-3">
                        {usernameAvailability.available ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  {usernameAvailability.checked && (
                    <p className={`text-sm ${usernameAvailability.available ? "text-green-600" : "text-red-600"}`}>
                      {usernameAvailability.available ? "Username is available" : "Username is taken"}
                    </p>
                  )}
                  <FormMessage />
                  <p className="text-xs text-neutral-500">
                    Username cannot be changed later. Use 3-20 characters with letters, numbers, and underscores only.
                  </p>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Enter your email address" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="e.g., +44 7123 456789 or 07123 456789" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-neutral-500">
                      Must be 18+
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postcode</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SW1A 1AA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full" 
              disabled={completeProfileMutation.isPending || (usernameAvailability.checked && !usernameAvailability.available)}
            >
              {completeProfileMutation.isPending ? "Completing Profile..." : "Complete Profile"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}