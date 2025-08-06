import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { 
  insertTeamSchema, 
  insertEventSchema, 
  insertNotificationSchema,
  insertEventAttendanceSchema,
  insertPaymentSchema,
  insertNotificationPreferencesSchema,
  insertFlareResponseSchema 
} from "@shared/schema";
import { z } from "zod";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Object storage routes for team images
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log("Generated upload URL:", uploadURL);
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Team image update endpoint
  app.put("/api/teams/:id/image", isAuthenticated, async (req: any, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    const userId = req.user.claims.sub;
    try {
      console.log("Received image URL:", req.body.imageURL);
      
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.imageURL);
      
      console.log("Normalized object path:", objectPath);

      // Update team with the image path
      await storage.updateTeamImage(req.params.id, userId, objectPath);

      res.status(200).json({ objectPath: objectPath });
    } catch (error) {
      console.error("Error setting team image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile management routes
  app.put('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { updateProfileSchema } = await import('@shared/schema');
      const profileData = updateProfileSchema.parse(req.body);
      
      const updatedUser = await storage.updateUserProfile(userId, profileData);
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post('/api/profile/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { profileCompletionSchema } = await import('@shared/schema');
      const profileData = profileCompletionSchema.parse(req.body);
      
      // Check if username is available
      const isUsernameAvailable = await storage.checkUsernameAvailability(profileData.username, userId);
      if (!isUsernameAvailable) {
        return res.status(400).json({
          message: "Username is already taken",
          errors: [{ path: ["username"], message: "Username is already taken" }]
        });
      }
      
      const updatedUser = await storage.completeUserProfile(userId, profileData);
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      }
      console.error("Error completing profile:", error);
      res.status(500).json({ message: "Failed to complete profile" });
    }
  });

  app.get('/api/profile/check-username/:username', isAuthenticated, async (req: any, res) => {
    try {
      const { username } = req.params;
      const userId = req.user.claims.sub;
      const isAvailable = await storage.checkUsernameAvailability(username, userId);
      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Error checking username availability:", error);
      res.status(500).json({ message: "Failed to check username availability" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Team routes
  app.post('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Parse and validate the team data
      const teamData = insertTeamSchema.parse({
        ...req.body,
        ownerId: userId,
      });
      
      // Check if team name already exists
      const existingTeam = await storage.getTeamByName(teamData.name);
      if (existingTeam) {
        return res.status(409).json({ 
          message: "Team name already exists",
          field: "name"
        });
      }
      
      const team = await storage.createTeam(teamData, userId);
      res.json(team);
    } catch (error: any) {
      console.error("Error creating team:", error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        return res.status(400).json({ 
          message: firstError.message,
          field: firstError.path.join('.'),
          errors: error.errors
        });
      }
      
      // Handle database constraint violations
      if (error.message && error.message.includes('duplicate key')) {
        return res.status(409).json({ 
          message: "Team name already exists",
          field: "name"
        });
      }
      
      res.status(400).json({ message: "Failed to create team" });
    }
  });

  // Search teams - must come before /api/teams/:id routes
  app.get('/api/teams/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q: query } = req.query;
      const userId = req.user.claims.sub;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({ message: "Search query must be at least 2 characters" });
      }

      const results = await storage.searchTeams(query.trim(), userId);
      res.json(results);
    } catch (error) {
      console.error("Error searching teams:", error);
      res.status(500).json({ message: "Failed to search teams" });
    }
  });

  app.get('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const teams = await storage.getUserTeams(userId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get('/api/teams/:id', isAuthenticated, async (req, res) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.get('/api/teams/:id/members', isAuthenticated, async (req, res) => {
    try {
      const members = await storage.getTeamMembers(req.params.id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  app.post('/api/teams/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, role } = req.body;
      const membership = await storage.addTeamMember(req.params.id, userId, role);
      res.json(membership);
    } catch (error) {
      console.error("Error adding team member:", error);
      res.status(400).json({ message: "Failed to add team member" });
    }
  });

  // Update member role
  app.patch('/api/teams/:id/members/:userId/role', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId, userId } = req.params;
      const { role } = req.body;
      const currentUserId = req.user.claims.sub;
      
      const membership = await storage.updateMemberRole(teamId, userId, role, currentUserId);
      res.json(membership);
    } catch (error: any) {
      console.error("Error updating member role:", error);
      res.status(400).json({ message: error.message || "Failed to update member role" });
    }
  });

  // Block member
  app.post('/api/teams/:id/block/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId, userId } = req.params;
      const { reason } = req.body;
      const currentUserId = req.user.claims.sub;
      
      const blockedMember = await storage.blockMember(teamId, userId, currentUserId, reason);
      res.json(blockedMember);
    } catch (error: any) {
      console.error("Error blocking member:", error);
      res.status(400).json({ message: error.message || "Failed to block member" });
    }
  });

  // Unblock member
  app.delete('/api/teams/:id/block/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId, userId } = req.params;
      await storage.unblockMember(teamId, userId);
      res.json({ message: "Member unblocked successfully" });
    } catch (error: any) {
      console.error("Error unblocking member:", error);
      res.status(400).json({ message: error.message || "Failed to unblock member" });
    }
  });

  // Remove team member
  app.delete('/api/teams/:id/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId, userId } = req.params;
      const currentUserId = req.user.claims.sub;

      // Check if current user can remove members (team owner or admin)
      const membership = await storage.getUserTeam(currentUserId, teamId);
      const team = await storage.getTeam(teamId);
      
      if (!team || (team.ownerId !== currentUserId && (!membership || membership.role !== 'admin'))) {
        return res.status(403).json({ message: "Only team owners and admins can remove members" });
      }

      // Don't allow removing the team owner
      if (team.ownerId === userId) {
        return res.status(400).json({ message: "Cannot remove team owner" });
      }

      await storage.removeTeamMember(teamId, userId);
      res.json({ message: "Member removed successfully" });
    } catch (error: any) {
      console.error("Error removing team member:", error);
      res.status(400).json({ message: error.message || "Failed to remove member" });
    }
  });

  // Get blocked members
  app.get('/api/teams/:id/blocked', isAuthenticated, async (req: any, res) => {
    try {
      const blockedMembers = await storage.getBlockedMembers(req.params.id);
      res.json(blockedMembers);
    } catch (error) {
      console.error("Error fetching blocked members:", error);
      res.status(500).json({ message: "Failed to fetch blocked members" });
    }
  });

  // Send team invitation
  app.post('/api/teams/:id/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId } = req.params;
      const { userId } = req.body;
      const currentUserId = req.user.claims.sub;

      // Check if current user can send invitations (team owner or admin)
      const membership = await storage.getUserTeam(currentUserId, teamId);
      const team = await storage.getTeam(teamId);
      
      if (!team || (team.ownerId !== currentUserId && (!membership || membership.role !== 'admin'))) {
        return res.status(403).json({ message: "Only team owners and admins can send invitations" });
      }

      // Create invitation (this will handle all validation)
      const invitation = await storage.createTeamInvitation(teamId, userId, currentUserId);
      res.json({ message: "Invitation sent successfully", invitation });
    } catch (error: any) {
      console.error("Error sending team invitation:", error);
      res.status(400).json({ message: error.message || "Failed to send invitation" });
    }
  });

  // Accept team invitation
  app.post('/api/invitations/:invitationId/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      const userId = req.user.claims.sub;
      
      const membership = await storage.acceptTeamInvitation(invitationId, userId);
      res.json({ message: "Invitation accepted successfully", membership });
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(400).json({ message: error.message || "Failed to accept invitation" });
    }
  });

  // Decline team invitation
  app.post('/api/invitations/:invitationId/decline', isAuthenticated, async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.declineTeamInvitation(invitationId, userId);
      res.json({ message: "Invitation declined successfully" });
    } catch (error: any) {
      console.error("Error declining invitation:", error);
      res.status(400).json({ message: error.message || "Failed to decline invitation" });
    }
  });

  // Get user's pending invitations
  app.get('/api/users/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const invitations = await storage.getUserInvitations(userId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Leave team
  app.post('/api/teams/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.leaveTeam(teamId, userId);
      res.json({ message: "Successfully left the team" });
    } catch (error: any) {
      console.error("Error leaving team:", error);
      res.status(400).json({ message: error.message || "Failed to leave team" });
    }
  });

  // Approve join request
  app.post('/api/teams/:id/approve-join/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId, userId } = req.params;
      const currentUserId = req.user.claims.sub;
      
      const membership = await storage.approveJoinRequest(teamId, userId, currentUserId);
      res.json({ message: "Join request approved", membership });
    } catch (error: any) {
      console.error("Error approving join request:", error);
      res.status(400).json({ message: error.message || "Failed to approve join request" });
    }
  });

  // Reject join request
  app.post('/api/teams/:id/reject-join/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId, userId } = req.params;
      const currentUserId = req.user.claims.sub;
      
      await storage.rejectJoinRequest(teamId, userId, currentUserId);
      res.json({ message: "Join request rejected" });
    } catch (error: any) {
      console.error("Error rejecting join request:", error);
      res.status(400).json({ message: error.message || "Failed to reject join request" });
    }
  });

  // Check username availability
  app.get('/api/users/check-username/:username', isAuthenticated, async (req, res) => {
    try {
      const { username } = req.params;
      const existingUser = await storage.getUserByUsername(username);
      res.json({ available: !existingUser });
    } catch (error) {
      console.error("Error checking username:", error);
      res.status(500).json({ message: "Failed to check username" });
    }
  });

  // Search users for team invitations
  app.get('/api/users/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q: query, excludeTeam } = req.query;
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      let excludeUserIds: string[] = [];
      
      // If excludeTeam is provided, get team member IDs to exclude from search
      if (excludeTeam) {
        const teamMembers = await storage.getTeamMembers(excludeTeam);
        excludeUserIds = teamMembers.map(member => member.userId);
      }

      const users = await storage.searchUsers(query, excludeUserIds);
      
      // Remove sensitive information before sending to client
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        phoneNumber: user.phoneNumber // Include for search display purposes
      }));

      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

  // Check team name availability
  app.get('/api/teams/check-name/:name', isAuthenticated, async (req, res) => {
    try {
      const { name } = req.params;
      const existingTeam = await storage.getTeamByName(name);
      res.json({ available: !existingTeam });
    } catch (error) {
      console.error("Error checking team name:", error);
      res.status(500).json({ message: "Failed to check team name" });
    }
  });

  // Request to join team
  app.post('/api/teams/:id/request-join', isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId } = req.params;
      const userId = req.user.claims.sub;

      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      if (team.requiresApproval) {
        await storage.requestToJoinTeam(teamId, userId);
        res.json({ message: "Join request sent to team owner" });
      } else {
        const membership = await storage.joinTeam(teamId, userId);
        res.json({ message: "Successfully joined team", membership });
      }
    } catch (error: any) {
      console.error("Error joining team:", error);
      res.status(400).json({ message: error.message || "Failed to join team" });
    }
  });

  // Invite member to team
  app.post("/api/teams/:id/invite", isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId } = req.params;
      const { email } = req.body;
      const userId = req.user?.claims?.sub;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user is admin/captain of the team
      const userTeam = await storage.getUserTeam(userId, teamId);
      if (!userTeam || !["admin", "captain"].includes(userTeam.role)) {
        return res.status(403).json({ message: "Not authorized to invite members" });
      }

      // For now, just return success - in a real app, you'd send an email invitation
      res.json({ message: "Invitation sent successfully", email });
    } catch (error) {
      console.error("Error inviting member:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Update team settings
  app.put("/api/teams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId } = req.params;
      const userId = req.user?.claims?.sub;
      const updates = req.body;

      // Check if user is admin of the team
      const userTeam = await storage.getUserTeam(userId, teamId);
      if (!userTeam || userTeam.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to update team" });
      }

      // If updating team name, check for uniqueness
      if (updates.name) {
        const existingTeam = await storage.getTeamByName(updates.name);
        if (existingTeam && existingTeam.id !== teamId) {
          return res.status(409).json({ message: "Team name already exists" });
        }
      }

      // Filter out fields that shouldn't be updated via this endpoint
      const allowedUpdates = {
        name: updates.name,
        sports: updates.sports,
        description: updates.description,
        isPrivate: updates.isPrivate,
        requiresApproval: updates.requiresApproval,
      };

      const updatedTeam = await storage.updateTeam(teamId, allowedUpdates);
      res.json(updatedTeam);
    } catch (error: any) {
      console.error("Error updating team:", error);
      if (error.message && error.message.includes('duplicate key')) {
        return res.status(409).json({ message: "Team name already exists" });
      }
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  // Delete team
  app.delete("/api/teams/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id: teamId } = req.params;
      const userId = req.user?.claims?.sub;

      // Check if user is admin of the team
      const userTeam = await storage.getUserTeam(userId, teamId);
      if (!userTeam || userTeam.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete team" });
      }

      await storage.deleteTeam(teamId);
      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Event routes
  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Parse and validate the event data
      const eventData = insertEventSchema.parse({
        ...req.body,
        createdById: userId,
      });
      
      const event = await storage.createEvent(eventData);
      
      // Add the primary team to eventTeams table (required for getUserEvents to work)
      await storage.addEventTeam(event.id, eventData.primaryTeamId);
      
      // Add additional teams if specified
      if (req.body.additionalTeamIds && Array.isArray(req.body.additionalTeamIds)) {
        for (const teamId of req.body.additionalTeamIds) {
          await storage.addEventTeam(event.id, teamId);
        }
      }
      
      res.json(event);
    } catch (error: any) {
      console.error("Error creating event:", error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        return res.status(400).json({ 
          message: firstError.message,
          field: firstError.path.join('.'),
          errors: error.errors
        });
      }
      
      res.status(400).json({ message: "Failed to create event" });
    }
  });

  app.get('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const events = await storage.getUserEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get('/api/events/:id', isAuthenticated, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.put('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      
      // Get the event to check authorization
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if user has admin access to the primary team
      const userTeamMembership = await storage.getUserTeam(userId, existingEvent.primaryTeamId);
      const team = await storage.getTeam(existingEvent.primaryTeamId);
      
      // Allow editing if user is team owner or has admin role
      const canEdit = (team && team.ownerId === userId) || 
                     (userTeamMembership && userTeamMembership.role === "admin");
      
      if (!canEdit) {
        return res.status(403).json({ 
          message: "Not authorized to edit this event. Only team owners and admins can edit events." 
        });
      }
      
      // Parse and validate the event data
      const eventData = insertEventSchema.parse({
        ...req.body,
        createdById: userId,
      });
      
      const event = await storage.updateEvent(eventId, eventData);
      res.json(event);
    } catch (error: any) {
      console.error("Error updating event:", error);
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        return res.status(400).json({ 
          message: firstError.message,
          field: firstError.path.join('.'),
          errors: error.errors
        });
      }
      
      res.status(400).json({ message: "Failed to update event" });
    }
  });

  app.delete('/api/events/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteEvent(req.params.id);
      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Get event attendance
  app.get("/api/events/:id/attendance", isAuthenticated, async (req, res) => {
    try {
      const attendance = await storage.getEventAttendance(req.params.id);
      res.json(attendance);
    } catch (error) {
      console.error("Error fetching event attendance:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Vote on event attendance
  app.post("/api/events/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status } = req.body;
      if (!["attending", "not_attending"].includes(status)) {
        return res.status(400).json({ message: "Invalid vote status" });
      }

      const vote = await storage.voteOnEvent(req.params.id, userId, status);
      res.json(vote);
    } catch (error) {
      console.error("Error voting on event:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Remove vote from event
  app.delete("/api/events/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.removeVote(req.params.id, userId);
      res.json({ message: "Vote removed successfully" });
    } catch (error) {
      console.error("Error removing vote:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get event activity logs
  app.get("/api/events/:id/activity", isAuthenticated, async (req, res) => {
    try {
      const logs = await storage.getEventActivityLogs(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get potential players for event (team members who haven't voted)
  app.get("/api/events/:id/potential-players", isAuthenticated, async (req, res) => {
    try {
      const potentialPlayers = await storage.getEventPotentialPlayers(req.params.id);
      res.json(potentialPlayers);
    } catch (error) {
      console.error("Error fetching potential players:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const notificationData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(notificationData);
      res.json(notification);
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(400).json({ message: "Failed to create notification" });
    }
  });

  app.patch('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch('/api/notifications/read-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Get event activity audit logs (for team admins)
  app.get("/api/events/:eventId/audit", isAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user?.claims?.sub;

      // Check if user is admin/captain of the primary team for this event
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const userTeam = await storage.getUserTeam(userId, event.primaryTeamId);
      if (!userTeam || !["admin", "captain"].includes(userTeam.role)) {
        return res.status(403).json({ message: "Not authorized to view audit logs" });
      }

      const auditLogs = await storage.getEventActivityLogs(eventId);
      res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Notification preferences routes
  app.get('/api/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = await storage.getUserNotificationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.put('/api/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferencesData = insertNotificationPreferencesSchema.parse({
        ...req.body,
        userId,
      });
      const preferences = await storage.upsertNotificationPreferences(preferencesData);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(400).json({ message: "Failed to update notification preferences" });
    }
  });

  // Event attendance routes
  app.post('/api/events/:id/attendance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventId = req.params.id;
      const { status } = req.body;
      
      const attendanceData = insertEventAttendanceSchema.parse({
        eventId,
        userId,
        status,
      });
      
      const attendance = await storage.recordAttendance(attendanceData);
      res.json(attendance);
    } catch (error) {
      console.error("Error recording attendance:", error);
      res.status(400).json({ message: "Failed to record attendance" });
    }
  });

  app.get('/api/events/:id/attendance', isAuthenticated, async (req, res) => {
    try {
      const eventId = req.params.id;
      const attendance = await storage.getEventAttendance(eventId);
      res.json(attendance);
    } catch (error) {
      console.error("Error fetching event attendance:", error);
      res.status(500).json({ message: "Failed to fetch event attendance" });
    }
  });

  // Reserve player management routes
  app.post('/api/events/:id/promote-reserve', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const { userId } = req.body;
      const promotedById = req.user.claims.sub;

      // Check if the promoter has admin rights for this event
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Event creators can always manage reserves for their events
      const isEventCreator = event.createdById === promotedById;
      
      if (!isEventCreator) {
        // If not event creator, check team permissions
        const userTeam = await storage.getUserTeam(promotedById, event.primaryTeamId);
        const team = await storage.getTeam(event.primaryTeamId);
        if (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== promotedById)) {
          return res.status(403).json({ message: "Not authorized to manage reserves" });
        }
      }

      const updatedAttendance = await storage.promoteReservePlayer(eventId, userId, promotedById);
      res.json(updatedAttendance);
    } catch (error) {
      console.error("Error promoting reserve player:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to promote player" });
    }
  });

  app.post('/api/events/:id/demote-to-reserve', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const { userId } = req.body;
      const demotedById = req.user.claims.sub;

      // Check if the demoter has admin rights for this event
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Event creators can always manage reserves for their events
      const isEventCreator = event.createdById === demotedById;
      
      if (!isEventCreator) {
        // If not event creator, check team permissions
        const userTeam = await storage.getUserTeam(demotedById, event.primaryTeamId);
        const team = await storage.getTeam(event.primaryTeamId);
        if (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== demotedById)) {
          return res.status(403).json({ message: "Not authorized to manage reserves" });
        }
      }

      const updatedAttendance = await storage.demotePlayerToReserve(eventId, userId, demotedById);
      res.json(updatedAttendance);
    } catch (error) {
      console.error("Error demoting player to reserve:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to demote player" });
    }
  });

  app.get('/api/events/:id/reserves', isAuthenticated, async (req, res) => {
    try {
      const eventId = req.params.id;
      const reserves = await storage.getReservePlayers(eventId);
      res.json(reserves);
    } catch (error) {
      console.error("Error fetching reserve players:", error);
      res.status(500).json({ message: "Failed to fetch reserve players" });
    }
  });

  app.get('/api/events/:id/capacity', isAuthenticated, async (req, res) => {
    try {
      const eventId = req.params.id;
      const capacity = await storage.getEventCapacityInfo(eventId);
      res.json(capacity);
    } catch (error) {
      console.error("Error fetching event capacity:", error);
      res.status(500).json({ message: "Failed to fetch event capacity" });
    }
  });

  // Recurring Events API endpoints
  app.post('/api/events/recurring', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const eventData = { ...req.body, createdById: userId };
      
      // Validate the event data
      const validatedData = insertEventSchema.parse(eventData);
      
      // Create recurring events (4 weeks ahead by default)
      const createdEvents = await storage.createRecurringEvents(validatedData, 4);
      
      res.json(createdEvents);
    } catch (error) {
      console.error("Error creating recurring events:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create recurring events" });
    }
  });

  app.get('/api/events/series/:seriesId', isAuthenticated, async (req, res) => {
    try {
      const { seriesId } = req.params;
      const seriesEvents = await storage.getRecurringEventsSeries(seriesId);
      res.json(seriesEvents);
    } catch (error) {
      console.error("Error fetching recurring events series:", error);
      res.status(500).json({ message: "Failed to fetch recurring events series" });
    }
  });

  app.post('/api/events/series/:seriesId/suspend', isAuthenticated, async (req: any, res) => {
    try {
      const { seriesId } = req.params;
      const userId = req.user.claims.sub;
      
      // Check authorization - user must be event creator or team admin
      const seriesEvents = await storage.getRecurringEventsSeries(seriesId);
      if (seriesEvents.length === 0) {
        return res.status(404).json({ message: "Recurring series not found" });
      }
      
      const firstEvent = seriesEvents[0];
      const isEventCreator = firstEvent.createdById === userId;
      
      if (!isEventCreator) {
        const userTeam = await storage.getUserTeam(userId, firstEvent.primaryTeamId);
        const team = await storage.getTeam(firstEvent.primaryTeamId);
        if (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== userId)) {
          return res.status(403).json({ message: "Not authorized to manage recurring events" });
        }
      }
      
      await storage.suspendRecurringSeries(seriesId, userId);
      res.json({ message: "Recurring series suspended successfully" });
    } catch (error) {
      console.error("Error suspending recurring series:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to suspend recurring series" });
    }
  });

  app.post('/api/events/series/:seriesId/resume', isAuthenticated, async (req: any, res) => {
    try {
      const { seriesId } = req.params;
      const userId = req.user.claims.sub;
      
      // Check authorization - user must be event creator or team admin
      const seriesEvents = await storage.getRecurringEventsSeries(seriesId);
      if (seriesEvents.length === 0) {
        return res.status(404).json({ message: "Recurring series not found" });
      }
      
      const firstEvent = seriesEvents[0];
      const isEventCreator = firstEvent.createdById === userId;
      
      if (!isEventCreator) {
        const userTeam = await storage.getUserTeam(userId, firstEvent.primaryTeamId);
        const team = await storage.getTeam(firstEvent.primaryTeamId);
        if (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== userId)) {
          return res.status(403).json({ message: "Not authorized to manage recurring events" });
        }
      }
      
      await storage.resumeRecurringSeries(seriesId, userId);
      res.json({ message: "Recurring series resumed successfully" });
    } catch (error) {
      console.error("Error resuming recurring series:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to resume recurring series" });
    }
  });

  app.post('/api/events/series/:seriesId/publish', isAuthenticated, async (req: any, res) => {
    try {
      const { seriesId } = req.params;
      const userId = req.user.claims.sub;
      
      // Check authorization - user must be event creator or team admin
      const seriesEvents = await storage.getRecurringEventsSeries(seriesId);
      if (seriesEvents.length === 0) {
        return res.status(404).json({ message: "Recurring series not found" });
      }
      
      const firstEvent = seriesEvents[0];
      const isEventCreator = firstEvent.createdById === userId;
      
      if (!isEventCreator) {
        const userTeam = await storage.getUserTeam(userId, firstEvent.primaryTeamId);
        const team = await storage.getTeam(firstEvent.primaryTeamId);
        if (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== userId)) {
          return res.status(403).json({ message: "Not authorized to publish recurring events" });
        }
      }
      
      await storage.publishRecurringSeries(seriesId, userId);
      res.json({ message: "Recurring series published successfully" });
    } catch (error) {
      console.error("Error publishing recurring series:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to publish recurring series" });
    }
  });

  app.delete('/api/events/:id/recurring', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const { deleteSeriesAfter } = req.query;
      const userId = req.user.claims.sub;
      
      // Check authorization
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      const isEventCreator = event.createdById === userId;
      
      if (!isEventCreator) {
        const userTeam = await storage.getUserTeam(userId, event.primaryTeamId);
        const team = await storage.getTeam(event.primaryTeamId);
        if (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== userId)) {
          return res.status(403).json({ message: "Not authorized to delete recurring events" });
        }
      }
      
      await storage.deleteRecurringEvent(eventId, deleteSeriesAfter === 'true');
      res.json({ message: "Event(s) deleted successfully" });
    } catch (error) {
      console.error("Error deleting recurring event:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Failed to delete recurring event" });
    }
  });

  // Payment routes
  app.post('/api/create-payment-intent', isAuthenticated, async (req: any, res) => {
    try {
      const { amount, eventId, type = 'event_fee' } = req.body;
      const userId = req.user.claims.sub;

      // Create payment record
      const paymentData = insertPaymentSchema.parse({
        userId,
        eventId,
        amount: amount.toString(),
        type,
        status: 'pending',
      });
      
      const payment = await storage.createPayment(paymentData);

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency: "gbp",
        metadata: {
          paymentId: payment.id,
          userId,
          eventId: eventId || '',
          type,
        },
      });

      // Update payment with Stripe intent ID
      await storage.updatePaymentStatus(payment.id, 'pending', paymentIntent.id);

      res.json({ clientSecret: paymentIntent.client_secret, paymentId: payment.id });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  app.get('/api/payments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const payments = await storage.getUserPayments(userId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get('/api/events/:id/payments', isAuthenticated, async (req, res) => {
    try {
      const eventId = req.params.id;
      const payments = await storage.getEventPayments(eventId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching event payments:", error);
      res.status(500).json({ message: "Failed to fetch event payments" });
    }
  });

  // Flare gun routes - for advertising events to nearby users
  app.post('/api/events/:id/flare', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const userId = req.user.claims.sub;
      const { sport } = req.body;

      // Verify user owns/manages this event
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if user is team owner/admin/captain
      const userTeams = await storage.getUserTeams(userId);
      const isAuthorized = userTeams.some(team => 
        team.id === event.primaryTeamId && ['admin', 'captain'].includes(team.role)
      );

      if (!isAuthorized) {
        return res.status(403).json({ message: "Not authorized to send flare gun for this event" });
      }

      // Find nearby users interested in this sport
      const nearbyUsers = await storage.findNearbyUsers(eventId, sport);
      const userIds = nearbyUsers.map(user => user.id);

      // Send notifications
      if (userIds.length > 0) {
        await storage.sendFlareNotifications(eventId, userIds);
      }

      res.json({ 
        message: "Flare gun sent successfully", 
        recipientCount: userIds.length,
        recipients: nearbyUsers.map(u => ({ 
          id: u.id, 
          username: u.username, 
          firstName: u.firstName 
        }))
      });
    } catch (error) {
      console.error("Error sending flare gun:", error);
      res.status(500).json({ message: "Failed to send flare gun" });
    }
  });

  app.post('/api/events/:id/flare-response', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const userId = req.user.claims.sub;
      const responseData = insertFlareResponseSchema.parse({
        ...req.body,
        eventId,
        userId,
      });

      const response = await storage.respondToFlare(eventId, userId, responseData.status);
      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      }
      console.error("Error responding to flare:", error);
      res.status(500).json({ message: "Failed to respond to flare" });
    }
  });

  app.get('/api/events/:id/flare-responses', isAuthenticated, async (req, res) => {
    try {
      const eventId = req.params.id;
      const responses = await storage.getFlareResponses(eventId);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching flare responses:", error);
      res.status(500).json({ message: "Failed to fetch flare responses" });
    }
  });

  // Search for flare gun events by location
  app.get('/api/flare-events', isAuthenticated, async (req, res) => {
    try {
      const { postcode, radius = '10', sport } = req.query;
      
      if (!postcode) {
        return res.status(400).json({ message: "Postcode is required" });
      }

      const events = await storage.searchFlareEvents(
        postcode as string, 
        parseInt(radius as string), 
        sport as string
      );
      res.json(events);
    } catch (error) {
      console.error("Error searching flare events:", error);
      res.status(500).json({ message: "Failed to search flare events" });
    }
  });

  // User events management routes
  app.post('/api/user-events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
      }

      await storage.addUserEvent(userId, eventId);
      res.json({ message: "Event added to your events" });
    } catch (error) {
      console.error("Error adding user event:", error);
      res.status(500).json({ message: "Failed to add event" });
    }
  });

  app.delete('/api/user-events/:eventId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.params;

      await storage.removeUserEvent(userId, eventId);
      res.json({ message: "Event removed from your events" });
    } catch (error) {
      console.error("Error removing user event:", error);
      res.status(500).json({ message: "Failed to remove event" });
    }
  });

  app.get('/api/user-events/:eventId/following', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.params;

      const isFollowing = await storage.isUserFollowingEvent(userId, eventId);
      res.json({ isFollowing });
    } catch (error) {
      console.error("Error checking user event status:", error);
      res.status(500).json({ message: "Failed to check event status" });
    }
  });

  // Stripe webhook (for handling payment confirmations)
  app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
      console.log(`Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const paymentId = paymentIntent.metadata.paymentId;
        if (paymentId) {
          await storage.updatePaymentStatus(paymentId, 'paid', paymentIntent.id);
        }
        break;
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        const failedPaymentId = failedPayment.metadata.paymentId;
        if (failedPaymentId) {
          await storage.updatePaymentStatus(failedPaymentId, 'failed');
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
