import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { collectPaymentHandler } from "./routes/payments";
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

    const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
      
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
      const userId = (req.user as any).claims.sub;

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
      const userId = (req.user as any).claims.sub;
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

  // Get team statistics
  app.get('/api/teams/:id/stats', isAuthenticated, async (req: any, res) => {
    try {
      const teamId = req.params.id;
      const userId = (req.user as any).claims.sub;
      const stats = await storage.getTeamStats(teamId, userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching team stats:", error);
      res.status(500).json({ message: "Failed to fetch team stats" });
    }
  });

  // Get team pending join requests
  app.get('/api/teams/:id/pending-requests', isAuthenticated, async (req: any, res) => {
    try {
      const teamId = req.params.id;
      const pendingRequests = await storage.getTeamPendingRequests(teamId);
      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      res.status(500).json({ message: "Failed to fetch pending requests" });
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
      const currentUserId = (req.user as any).claims.sub;
      
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
      const currentUserId = (req.user as any).claims.sub;
      
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
      const currentUserId = (req.user as any).claims.sub;

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
      const currentUserId = (req.user as any).claims.sub;

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
      const userId = (req.user as any).claims.sub;
      
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
      const userId = (req.user as any).claims.sub;
      
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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
      
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
      const currentUserId = (req.user as any).claims.sub;
      
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
      const currentUserId = (req.user as any).claims.sub;
      
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
      const { q: query, excludeTeam, excludeBlocked } = req.query;
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      let excludeUserIds: string[] = [];
      
      // If excludeTeam is provided, get team member IDs to exclude from search
      if (excludeTeam) {
        const teamMembers = await storage.getTeamMembers(excludeTeam);
        excludeUserIds = teamMembers.map(member => member.userId);
      }

      // If excludeBlocked is provided, get blocked user IDs to exclude from search
      if (excludeBlocked) {
        const blockedMembers = await storage.getBlockedMembers(excludeBlocked);
        const blockedUserIds = blockedMembers.map(blocked => blocked.userId);
        excludeUserIds = [...excludeUserIds, ...blockedUserIds];
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
      const userId = (req.user as any).claims.sub;

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

      // Check if user is owner or admin of the team
      const userTeam = await storage.getUserTeam(userId, teamId);
      const team = await storage.getTeam(teamId);
      
      // Allow team owners and admins to delete the team
      const canDelete = (team && team.ownerId === userId) || (userTeam && userTeam.role === "admin");
      
      if (!canDelete) {
        return res.status(403).json({ message: "Not authorized to delete team. Only team owners and admins can delete teams." });
      }

      await storage.deleteTeam(teamId);
      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Event routes
  // Event-driven maintenance endpoint (checks expired events)
  app.post('/api/events/check-expired', isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.checkExpiredRecurringEvents();
      res.json({ 
        message: `Checked expired events, triggered maintenance for ${result.maintenanceTriggered.length} series`,
        maintenanceTriggered: result.maintenanceTriggered 
      });
    } catch (error) {
      console.error("Error checking expired recurring events:", error);
      res.status(500).json({ message: "Failed to check expired recurring events" });
    }
  });

  // Manual maintenance endpoint for recurring events (fallback)
  app.post('/api/events/maintain-recurring', isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.maintainRecurringEvents();
      res.json({ 
        message: `Maintained ${result.maintained} recurring series, created ${result.created} new events`,
        ...result 
      });
    } catch (error) {
      console.error("Error maintaining recurring events:", error);
      res.status(500).json({ message: "Failed to maintain recurring events" });
    }
  });

  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const venueOrganiserId = req.body.venueOrganiserId || (req.body.paymentRequired ? userId : null);

      // Parse and validate the event data
      const eventData = insertEventSchema.parse({
        ...req.body,
        venueOrganiserId,
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

      // Send notifications to team members about new event
      try {
        const teamMembers = await storage.getTeamMembers(eventData.primaryTeamId);
        const eventCreator = await storage.getUserById(userId);
        
        for (const member of teamMembers) {
          // Don't notify the event creator
          if (member.userId !== userId) {
            await storage.createNotificationIfAllowed({
              userId: member.userId,
              title: "New Event Created",
              message: `${eventCreator?.firstName || 'Team member'} created a new event: "${event.name}" on ${event.startDate} at ${event.startTime}`,
              type: "new_event",
              relatedId: event.id
            });
          }
        }
        
        // Also notify additional team members
        if (req.body.additionalTeamIds && Array.isArray(req.body.additionalTeamIds)) {
          for (const teamId of req.body.additionalTeamIds) {
            const additionalMembers = await storage.getTeamMembers(teamId);
            for (const member of additionalMembers) {
              if (member.userId !== userId) {
                await storage.createNotificationIfAllowed({
                  userId: member.userId,
                  title: "New Event Created",
                  message: `${eventCreator?.firstName || 'Team member'} created a new event: "${event.name}" on ${event.startDate} at ${event.startTime}`,
                  type: "new_event",
                  relatedId: event.id
                });
              }
            }
          }
        }
      } catch (notificationError) {
        console.error("Error sending new event notifications:", notificationError);
        // Don't fail event creation if notifications fail
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
      const userId = (req.user as any).claims.sub;
      const includePast = req.query.includePast === 'true';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || (includePast ? 5 : 1000); // Default to 5 for past events, unlimited for future events
      const teamId = req.query.teamId as string | undefined;
      const votingStatus = (req.query.votingStatus as string) || 'all';
      
      // Check for expired recurring events and trigger maintenance if needed
      await storage.checkExpiredRecurringEvents();
      
      const events = await storage.getUserEvents(userId, includePast, page, limit, teamId, votingStatus);
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
      const userId = (req.user as any).claims.sub;
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
      
      const venueOrganiserId = req.body.venueOrganiserId || (req.body.paymentRequired ? userId : null);

      // Parse and validate the event data
      const eventData = insertEventSchema.parse({
        ...req.body,
        venueOrganiserId,
        createdById: userId,
      });
      
      const event = await storage.updateEvent(eventId, eventData);
      
      // Send notifications to team members about event changes
      try {
        const teamMembers = await storage.getTeamMembers(existingEvent.primaryTeamId);
        const eventUpdater = await storage.getUserById(userId);
        
        for (const member of teamMembers) {
          // Don't notify the person who made the change
          if (member.userId !== userId) {
            await storage.createNotificationIfAllowed({
              userId: member.userId,
              title: "Event Updated",
              message: `${eventUpdater?.firstName || 'Team member'} updated the event: "${event.name}"`,
              type: "event_changed",
              relatedId: event.id
            });
          }
        }
      } catch (notificationError) {
        console.error("Error sending event update notifications:", notificationError);
        // Don't fail event update if notifications fail
      }
      
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

      const eventId = req.params.id;
      
      // If voting to attend, check if event requires payment authorization
      if (status === "attending") {
        const event = await storage.getEvent(eventId);
        if (!event) {
          return res.status(404).json({ message: "Event not found" });
        }

        // Check if event requires payment authorization (maxPlayerPayment field)
        const maxPlayerPayment = parseFloat(event.maxPlayerPayment || "0");
        
        console.log(`Voting check: event.paymentRequired=${event.paymentRequired}, maxPlayerPayment=${maxPlayerPayment}`);
        
        // If event requires payment authorization, check if user needs to authorize payment
        if (event.paymentRequired && maxPlayerPayment > 0 && userId !== event.venueOrganiserId) {
          console.log("Payment authorization required - checking existing authorization");
          
          // Check if user already has a payment authorization for this event
          try {
            const existingPayment = await storage.getEventPaymentByUser(eventId, userId);
            
            if (!existingPayment) {
              // No existing payment authorization - user needs to authorize payment first
              return res.status(400).json({ 
                message: "Payment authorization required",
                requiresPaymentAuth: true,
                maxPlayerPayment,
                details: `This event requires payment authorization up to £${maxPlayerPayment.toFixed(2)}. Please authorize payment to confirm your attendance.`
              });
            }
            
            // Check if existing payment is in a valid state for voting
            if (existingPayment.status === 'setup_pending' || existingPayment.status === 'setup_complete') {
              return res.status(400).json({ 
                message: "Payment authorization required",
                requiresPaymentAuth: true,
                maxPlayerPayment,
                details: `Please complete your payment authorization to confirm attendance.`
              });
            }
            
            // If payment was cancelled, user needs to re-authorize
            if (existingPayment.status === 'cancelled') {
              return res.status(400).json({ 
                message: "Payment authorization required",
                requiresPaymentAuth: true,
                maxPlayerPayment,
                details: `Your previous payment authorization was cancelled. Please authorize a new payment to confirm attendance.`
              });
            }
            
            // Payment is authorized (hold_created), allow voting to proceed
            console.log(`Payment check passed: existing payment status = ${existingPayment.status}`);
          } catch (error) {
            console.error("Error checking existing payment:", error);
            // If we can't check existing payment, require authorization
            return res.status(400).json({ 
              message: "Payment authorization required",
              requiresPaymentAuth: true,
              maxPlayerPayment,
              details: `This event requires payment authorization up to £${maxPlayerPayment.toFixed(2)}. Please authorize payment to confirm your attendance.`
            });
          }
        }
      }

      const vote = await storage.voteOnEvent(eventId, userId, status);
      res.json(vote);
    } catch (error) {
      console.error("Error voting on event:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Authorize payment from notification
  app.post("/api/notifications/:notificationId/authorize-payment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const notificationId = req.params.notificationId;
      const { paymentMethodId } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!paymentMethodId) {
        return res.status(400).json({ message: "Payment method is required" });
      }

      // Get notification and verify it's for payment authorization
      const notification = await storage.getNotificationById(notificationId);
      if (!notification || notification.userId !== userId || notification.type !== "payment_authorization_required") {
        return res.status(404).json({ message: "Invalid notification" });
      }

      // Parse metadata to get event and payment details
      const metadata = JSON.parse(notification.metadata || '{}');
      const eventId = metadata.eventId;
      const amount = metadata.amount;

      if (!eventId || !amount) {
        return res.status(400).json({ message: "Invalid notification data" });
      }

      // Get event details
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if event is in the past to determine capture method
      const now = new Date();
      let eventEndTime: Date;
      
      if (event.endDate && event.endTime) {
        eventEndTime = new Date(`${event.endDate}T${event.endTime}`);
      } else if (event.startDate && event.endTime) {
        eventEndTime = new Date(`${event.startDate}T${event.endTime}`);
      } else {
        // Assume event ended if no end time provided and start date is today or earlier
        eventEndTime = new Date(event.startDate);
        eventEndTime.setHours(23, 59, 59);
      }
      
      const isEventInPast = eventEndTime < now;
      console.log(`Event ${eventId} is ${isEventInPast ? 'in the past' : 'in the future'}, using ${isEventInPast ? 'immediate capture' : 'authorization hold'}`);

      // Get user and verify they have a Stripe customer ID
      const user = await storage.getUserById(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "User has no payment methods set up" });
      }

      // Determine if this should be immediate payment or authorization hold
      const shouldCaptureImmediately = isEventInPast || notificationId; // Capture for past events OR notification-based payments
      
      let paymentIntentData: any = {
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency: "gbp",
        customer: user.stripeCustomerId,
        capture_method: 'manual', // Always use manual capture for flexibility
        metadata: {
          eventId,
          userId,
          type: shouldCaptureImmediately ? 'event_payment' : 'event_authorization',
          notificationId: notificationId || '',
          isNotificationPayment: notificationId ? 'true' : 'false'
        },
      };

      // Handle specific payment methods
      if (paymentMethodId === 'apple-pay' || paymentMethodId === 'google-pay') {
        // For Apple Pay and Google Pay, don't set automatic_payment_methods
        paymentIntentData.payment_method_types = [paymentMethodId === 'apple-pay' ? 'apple_pay' : 'google_pay'];
        paymentIntentData.confirm = true;
        paymentIntentData.return_url = `${req.protocol}://${req.get('host')}/events/${eventId}`;
      } else if (paymentMethodId === 'paypal') {
        paymentIntentData.payment_method_types = ['paypal'];
        paymentIntentData.confirm = true;
        paymentIntentData.return_url = `${req.protocol}://${req.get('host')}/events/${eventId}`;
      } else if (paymentMethodId === 'new-card') {
        paymentIntentData.payment_method_types = ['card'];
        paymentIntentData.automatic_payment_methods = {
          enabled: true,
          allow_redirects: 'never'
        };
        paymentIntentData.confirm = true;
        paymentIntentData.return_url = `${req.protocol}://${req.get('host')}/events/${eventId}`;
      } else {
        // Use existing saved payment method
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirm = true;
        paymentIntentData.return_url = `${req.protocol}://${req.get('host')}/events/${eventId}`;
      }

      // Create payment intent
      let paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

      // Immediately capture for notification-based payments or past events
      if (shouldCaptureImmediately && paymentIntent.status === 'requires_capture') {
        console.log(`Immediately capturing payment: ${notificationId ? 'notification-based' : 'past event'} payment for event ${eventId}`);
        paymentIntent = await stripe.paymentIntents.capture(paymentIntent.id);
      }

      // Store payment record with appropriate status
      const paymentStatus = shouldCaptureImmediately ? 'captured' : 'authorized';
      const paymentData = insertPaymentSchema.parse({
        userId,
        eventId,
        amount: amount.toString(),
        type: 'event_fee',
        status: paymentStatus,
      });
      
      const payment = await storage.createPayment(paymentData);
      await storage.updatePaymentStatus(payment.id, paymentStatus, paymentIntent.id);

      // Create/update event payment record with appropriate status
      const eventPaymentStatus = shouldCaptureImmediately ? 'captured' : 'hold_created';
      try {
        const existingEventPayment = await storage.getEventPayment(eventId, userId);
        
        if (existingEventPayment) {
          await storage.updateEventPaymentSetup(eventId, userId, {
            status: eventPaymentStatus,
            paymentIntentId: paymentIntent.id,
            updatedAt: new Date()
          });
        } else {
          await storage.createEventPayment({
            eventId,
            userId,
            stripeCustomerId: user.stripeCustomerId,
            paymentIntentId: paymentIntent.id,
            status: eventPaymentStatus
          });
        }
      } catch (eventPaymentError) {
        console.error("Error creating/updating event payment record:", eventPaymentError);
      }

      // Mark notification as read and update metadata to indicate authorization completed
      await storage.markNotificationAsRead(notificationId);
      await storage.updateNotificationMetadata(notificationId, JSON.stringify({
        ...metadata,
        authorizationCompleted: true,
        paymentIntentId: paymentIntent.id
      }));

      // Auto-vote the user as attending
      await storage.voteOnEvent(eventId, userId, "attending");

      res.json({
        success: true,
        message: shouldCaptureImmediately 
          ? "Payment captured successfully and attendance confirmed" 
          : "Payment authorized and attendance confirmed",
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        paymentStatus: shouldCaptureImmediately ? 'captured' : 'authorized'
      });

    } catch (error: any) {
      console.error("Payment authorization from notification failed:", error);
      res.status(500).json({ 
        message: "Failed to authorize payment", 
        details: error.message 
      });
    }
  });

  // Authorize payment hold for event attendance
  app.post("/api/events/:id/authorize-payment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const eventId = req.params.id;
      const { paymentMethodId, amount } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!paymentMethodId || !amount) {
        return res.status(400).json({ message: "Payment method ID and amount are required" });
      }

      // Get user and verify they have a Stripe customer ID
      const user = await storage.getUserById(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "User has no payment methods set up" });
      }

      // Get event to verify it requires payment
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (!event.paymentRequired) {
        return res.status(400).json({ message: "Event does not require payment" });
      }

      // Handle different payment method types
      let paymentIntentData: any = {
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency: "gbp",
        customer: user.stripeCustomerId,
        capture_method: 'manual', // This creates an authorization hold
        metadata: {
          eventId,
          userId,
          type: 'event_authorization'
        },
      };

      // Handle specific payment methods
      if (paymentMethodId === 'apple-pay' || paymentMethodId === 'google-pay') {
        // For Apple Pay and Google Pay, don't set automatic_payment_methods
        paymentIntentData.payment_method_types = [paymentMethodId === 'apple-pay' ? 'apple_pay' : 'google_pay'];
        paymentIntentData.confirm = true;
        paymentIntentData.return_url = `${req.protocol}://${req.get('host')}/events/${eventId}`;
      } else if (paymentMethodId === 'paypal') {
        paymentIntentData.payment_method_types = ['paypal'];
        paymentIntentData.confirm = true;
        paymentIntentData.return_url = `${req.protocol}://${req.get('host')}/events/${eventId}`;
      } else if (paymentMethodId === 'new-card') {
        paymentIntentData.payment_method_types = ['card'];
        paymentIntentData.automatic_payment_methods = {
          enabled: true,
          allow_redirects: 'never'
        };
      } else {
        // Use existing saved payment method
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirm = true;
        paymentIntentData.return_url = `${req.protocol}://${req.get('host')}/events/${eventId}`;
      }

      // Create payment intent with authorization hold
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

      // Store payment record (create new one for each authorization attempt)
      const paymentData = insertPaymentSchema.parse({
        userId,
        eventId,
        amount: amount.toString(),
        type: 'event_fee',
        status: 'authorized',
      });
      
      const payment = await storage.createPayment(paymentData);
      await storage.updatePaymentStatus(payment.id, 'authorized', paymentIntent.id);
      console.log(`Authorize Payment: Created new payment record ${payment.id} with intent ${paymentIntent.id}`);

      // Also create/update the event payment record for voting logic
      try {
        // Check if event payment record already exists (including cancelled ones)
        const existingEventPayment = await storage.getEventPayment(eventId, userId);
        
        if (existingEventPayment) {
          // Update existing record (whether it was cancelled or not)
          console.log(`Authorize Payment: Updating existing eventPayment from status '${existingEventPayment.status}' to 'hold_created'`);
          await storage.updateEventPaymentSetup(eventId, userId, {
            status: 'hold_created',
            paymentIntentId: paymentIntent.id,
            updatedAt: new Date()
          });
        } else {
          // Create new event payment record
          console.log(`Authorize Payment: Creating new eventPayment with status 'hold_created'`);
          await storage.createEventPayment({
            eventId,
            userId,
            stripeCustomerId: user.stripeCustomerId,
            paymentIntentId: paymentIntent.id,
            status: 'hold_created'
          });
        }
      } catch (eventPaymentError) {
        console.error("Error creating/updating event payment record:", eventPaymentError);
        // Continue execution since the main payment was successful
      }

      res.json({ 
        success: true, 
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret 
      });
    } catch (error: any) {
      console.error("Payment authorization failed:", error);
      res.status(500).json({ 
        message: "Failed to authorize payment", 
        details: error.message 
      });
    }
  });

  // Collect payment for past events
  app.post("/api/events/:id/collect-payment", isAuthenticated, collectPaymentHandler);

  // Get event audit data (voting and payments) - Admin/Owner access only
  app.get("/api/events/:id/audit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const eventId = req.params.id;
      
      console.log(`[AUDIT] Request for event ${eventId} by user ${userId}`);
      
      if (!userId) {
        console.log(`[AUDIT] No userId found`);
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get event and check admin access
      const event = await storage.getEvent(eventId);
      if (!event) {
        console.log(`[AUDIT] Event ${eventId} not found`);
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if user has admin access to the primary team
      const userTeam = await storage.getUserTeam(userId, event.primaryTeamId);
      const team = await storage.getTeam(event.primaryTeamId);
      const isEventCreator = event.createdById === userId;
      
      console.log(`[AUDIT] User permissions - isEventCreator: ${isEventCreator}, userTeam: ${JSON.stringify(userTeam)}, teamOwner: ${team?.ownerId}`);
      
      if (!isEventCreator && (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== userId))) {
        console.log(`[AUDIT] Access denied for user ${userId} on event ${eventId}`);
        return res.status(403).json({ message: "Not authorized to view audit data" });
      }

      // Get voting audit data (activity logs)
      console.log(`[AUDIT] Fetching voting audit data`);
      const votingAudit = await storage.getEventActivityLogs(eventId);
      
      // Get payments audit data
      console.log(`[AUDIT] Fetching payments audit data`);
      const paymentsAudit = await storage.getEventPayments(eventId);
      const eventPaymentRecords = await storage.getEventPaymentRecords(eventId);

      res.json({
        event: {
          id: event.id,
          name: event.name,
          paymentCollectionInitiated: event.paymentCollectionInitiated,
          paymentCollectionInitiatedAt: event.paymentCollectionInitiatedAt,
          paymentCollectionInitiatedBy: event.paymentCollectionInitiatedBy,
          paymentStatus: event.paymentStatus
        },
        votingAudit: votingAudit.map(log => ({
          id: log.id,
          eventId: log.eventId,
          userId: log.userId,
          action: log.action,
          previousStatus: log.previousStatus,
          newStatus: log.newStatus,
          timestamp: log.timestamp,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          user: log.user
        })),
        paymentsAudit: {
          eventPayments: eventPaymentRecords.map(payment => ({
            id: payment.id,
            userId: payment.userId,
            status: payment.status,
            holdAmount: payment.holdAmount,
            finalAmount: payment.finalAmount,
            paymentIntentId: payment.paymentIntentId,
            holdCreatedAt: payment.holdCreatedAt,
            capturedAt: payment.capturedAt,
            createdAt: payment.createdAt,
            user: payment.user
          })),
          transactions: paymentsAudit.map(payment => ({
            id: payment.id,
            userId: payment.userId,
            amount: payment.amount,
            status: payment.status,
            type: payment.type,
            paidAt: payment.paidAt,
            stripePaymentIntentId: payment.stripePaymentIntentId,
            createdAt: payment.createdAt,
            user: payment.user
          }))
        }
      });
      
      console.log(`[AUDIT] Successfully returned audit data for event ${eventId}`);
    } catch (error: any) {
      console.error("Error fetching audit data:", error);
      res.status(500).json({ message: "Failed to fetch audit data", error: error.message });
    }
  });

  // Stripe Connect routes
  app.post('/api/connect/create-account', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.body;
      const currentUserId = req.user?.claims?.sub;
      
      if (!userId || !currentUserId) {
        return res.status(400).json({ message: "User ID required" });
      }

      // Check if user already has a Connect account
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.stripeAccountId && user.payoutsEnabled) {
        return res.status(400).json({ message: "User already has a Connect account set up" });
      }

      // Create Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
      });

      // Update user with Connect account ID
      await storage.updateUserStripeAccountInfo(userId, account.id, false);

      // Create account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${req.protocol}://${req.get('host')}/settings`,
        return_url: `${req.protocol}://${req.get('host')}/settings?connect=success`,
        type: 'account_onboarding',
      });

      res.json({ url: accountLink.url });
    } catch (error: any) {
      console.error("Error creating Connect account:", error);
      res.status(500).json({ message: error.message || "Failed to create Connect account" });
    }
  });

  app.get('/api/connect/status/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUserById(userId);
      if (!user || !user.stripeAccountId) {
        return res.json({ 
          hasAccount: false, 
          payoutsEnabled: false,
          requiresOnboarding: true 
        });
      }

      // Check account status with Stripe
      const account = await stripe.accounts.retrieve(user.stripeAccountId);
      const payoutsEnabled = account.payouts_enabled && account.charges_enabled;

      // Update our database if status has changed
      if (payoutsEnabled !== user.payoutsEnabled) {
        await storage.updateUserStripeAccountInfo(userId, user.stripeAccountId, payoutsEnabled);
      }

      res.json({
        hasAccount: true,
        payoutsEnabled,
        requiresOnboarding: !payoutsEnabled,
        accountId: user.stripeAccountId
      });
    } catch (error: any) {
      console.error("Error checking Connect status:", error);
      res.status(500).json({ message: "Failed to check Connect status" });
    }
  });

  // Get team members for event organiser selection
  app.get('/api/events/:id/team-members', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if user has permission to collect payments
      const userTeam = await storage.getUserTeam(userId, event.primaryTeamId);
      const team = await storage.getTeam(event.primaryTeamId);
      const isEventCreator = event.createdById === userId;
      
      if (!isEventCreator && (!userTeam || (!["admin", "captain"].includes(userTeam.role) && team?.ownerId !== userId))) {
        return res.status(403).json({ message: "Not authorized to view team members" });
      }

      // Get team members
      const teamMembers = await storage.getTeamMembers(event.primaryTeamId);
      
      res.json(teamMembers.map(member => ({
        userId: member.userId,
        user: {
          id: member.userId,
          firstName: member.user?.firstName,
          lastName: member.user?.lastName,
          email: member.user?.email,
          username: member.user?.username,
          profileImageUrl: member.user?.profileImageUrl
        },
        role: member.role
      })));
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // Remove vote from event
  app.delete("/api/events/:id/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const eventId = req.params.id;

      // Check if user was attending and if event requires payment
      // IMPORTANT: Check attendance BEFORE removing the vote to detect if they were attending
      const [event, existingAttendance] = await Promise.all([
        storage.getEvent(eventId),
        storage.getUserAttendance(userId, eventId) // Note: correct parameter order
      ]);

      const wasAttending = existingAttendance?.status === "attending";
      console.log(`Unvote: User attendance status before removal: ${existingAttendance?.status}, wasAttending: ${wasAttending}`);

      // Remove the vote first
      await storage.removeVote(eventId, userId);

      // If user was attending and event requires payment, release the payment authorization
      if (wasAttending && event?.paymentRequired && userId !== event.venueOrganiserId) {
        console.log(`Unvote: User was attending paid event, attempting to cancel payment authorization`);
        
        try {
          // First try to get payment intent ID from eventPayments table
          const eventPayment = await storage.getEventPayment(eventId, userId);
          console.log(`Unvote: Found eventPayment:`, JSON.stringify(eventPayment, null, 2));
          
          let paymentIntentId = eventPayment?.paymentIntentId;
          
          // If not found in eventPayments, check the payments table
          if (!paymentIntentId) {
            console.log(`Unvote: No payment intent in eventPayments, checking payments table`);
            const payments = await storage.getEventPayments(eventId);
            const userPayment = payments.find(p => p.userId === userId && p.status === 'authorized');
            paymentIntentId = userPayment?.stripePaymentIntentId;
            console.log(`Unvote: Found userPayment with intent ID:`, paymentIntentId);
          }
          
          if (paymentIntentId) {
            console.log(`Unvote: Attempting to cancel payment intent: ${paymentIntentId}`);
            
            try {
              // Cancel the payment intent to release the authorization hold
              const cancelledIntent = await stripe.paymentIntents.cancel(paymentIntentId);
              console.log(`Unvote: Stripe cancellation response:`, {
                id: cancelledIntent.id,
                status: cancelledIntent.status,
                amount: cancelledIntent.amount,
                cancelled_at: cancelledIntent.canceled_at
              });
              
              // Update event payment status if record exists
              if (eventPayment) {
                console.log(`Unvote: Updating eventPayment status to cancelled`);
                // Use the existing storage method to update eventPayment status
                await storage.updateEventPaymentSetup(eventId, userId, {
                  status: 'cancelled',
                  updatedAt: new Date()
                });
              }

              // Also update the main payment record if it exists
              try {
                console.log(`Unvote: Updating payments table status to cancelled`);
                const payments = await storage.getEventPayments(eventId);
                const userPayment = payments.find(p => p.userId === userId && p.status === 'authorized');
                if (userPayment) {
                  await storage.updatePaymentStatus(userPayment.id, 'cancelled');
                  console.log(`Unvote: Updated payment ${userPayment.id} status to cancelled`);
                }
              } catch (paymentUpdateError) {
                console.error("Error updating payment record:", paymentUpdateError);
              }

              console.log(`Payment authorization successfully cancelled for user ${userId}, event ${eventId}`);
              
            } catch (stripeError) {
              console.error(`Unvote: Stripe cancellation failed:`, stripeError);
              throw stripeError;
            }
            
          } else {
            console.log(`Unvote: No payment intent ID found for user ${userId}, event ${eventId}`);
          }
        } catch (paymentError) {
          console.error("Error releasing payment authorization:", paymentError);
          // Don't fail the unvote if payment release fails
          // The vote removal was successful, which is the primary action
        }
      } else {
        console.log(`Unvote: No payment cancellation needed (wasAttending: ${wasAttending}, paymentRequired: ${event?.paymentRequired})`);
      }

      res.json({ 
        message: "Vote removed successfully",
        paymentReleased: wasAttending && event?.paymentRequired
      });
    } catch (error) {
      console.error("Error removing vote:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get event activity logs
  app.get("/api/events/:id/activity", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const logs = await storage.getEventActivityLogs(id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get potential players for event (team members who haven't voted)
  app.get("/api/events/:id/potential-players", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const potentialPlayers = await storage.getEventPotentialPlayers(id);
      res.json(potentialPlayers);
    } catch (error) {
      console.error("Error fetching potential players:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notification routes
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
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
      const notification = await storage.createNotificationIfAllowed(notificationData);
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
      const userId = (req.user as any).claims.sub;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Duplicate audit route removed - using the comprehensive one above

  // Notification preferences routes
  app.get('/api/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const preferences = await storage.getUserNotificationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  app.put('/api/notification-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
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
      const promotedById = (req.user as any).claims.sub;

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
      const demotedById = (req.user as any).claims.sub;

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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
      
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
      const userId = (req.user as any).claims.sub;
      
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
      const userId = (req.user as any).claims.sub;
      
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
      const userId = (req.user as any).claims.sub;
      
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
      const userId = (req.user as any).claims.sub;

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
      const userId = (req.user as any).claims.sub;
      const payments = await storage.getUserPayments(userId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get('/api/payments/incoming', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUserById(userId);
      const payments = await storage.getIncomingPayments(userId);

      if (user?.stripeAccountId) {
        for (const payment of payments) {
          if (payment.status === 'transferred') {
            try {
              const payouts = await stripe.payouts.list({ limit: 1 }, { stripeAccount: user.stripeAccountId });
              if (payouts.data.length > 0 && payouts.data[0].status === 'paid' && payouts.data[0].created * 1000 > new Date(payment.createdAt as any).getTime()) {
                await storage.updatePaymentStatus(payment.id, 'paid');
                payment.status = 'paid';
              }
            } catch (err) {
              console.error('Error checking payout status:', err);
            }
          }
        }
      }

      res.json(payments);
    } catch (error) {
      console.error('Error fetching incoming payments:', error);
      res.status(500).json({ message: 'Failed to fetch incoming payments' });
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

  // Get payment status for current user and event
  app.get('/api/events/:id/payment-status', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const userId = (req.user as any).claims.sub;
      
      const payment = await storage.getEventPaymentByUser(eventId, userId);
      
      if (!payment) {
        return res.json({ 
          hasPayment: false, 
          status: null,
          setupIntentId: null,
          paymentMethodId: null
        });
      }

      res.json({
        hasPayment: true,
        status: payment.status,
        setupIntentId: payment.setupIntentId,
        paymentMethodId: payment.paymentMethodId,
        holdAmount: payment.holdAmount,
        finalAmount: payment.finalAmount
      });
    } catch (error) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ message: "Failed to fetch payment status" });
    }
  });

  // Initialize payment setup for event (creates SetupIntent)
  app.post('/api/events/:id/payment-setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const eventId = req.params.id;

      // Get or create Stripe customer
      let user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { userId }
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, customerId);
      }

      // Check if payment record already exists
      let eventPayment = await storage.getEventPaymentByUser(eventId, userId);
      
      if (eventPayment && eventPayment.status === 'setup_complete') {
        return res.json({ status: 'already_complete' });
      }

      // Create SetupIntent for future payments
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card']
      });

      // Store or update in database
      if (eventPayment) {
        await storage.updateEventPaymentSetup(eventId, userId, {
          setupIntentId: setupIntent.id,
          setupIntentStatus: setupIntent.status as "requires_payment_method" | "requires_confirmation" | "succeeded" | "canceled",
          setupIntentClientSecret: setupIntent.client_secret,
          status: 'setup_pending'
        });
      } else {
        await storage.createEventPayment({
          eventId,
          userId,
          stripeCustomerId: customerId,
          setupIntentId: setupIntent.id,
          setupIntentStatus: setupIntent.status as "requires_payment_method" | "requires_confirmation" | "succeeded" | "canceled",
          setupIntentClientSecret: setupIntent.client_secret,
          status: 'setup_pending'
        });
      }

      res.json({ clientSecret: setupIntent.client_secret, status: 'setup_pending' });
    } catch (error: any) {
      console.error('Payment setup error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Flare gun routes - for advertising events to nearby users
  app.post('/api/events/:id/flare', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const userId = (req.user as any).claims.sub;
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

      // Activate flare status for this event
      await storage.activateFlareStatus(eventId, userId);

      // Send notifications and get actual count sent (excluding blocked users)  
      let actualRecipientCount = 0;
      if (userIds.length > 0) {
        await storage.sendFlareNotifications(eventId, userIds);
        actualRecipientCount = userIds.length;
      }

      res.json({ 
        message: "Flare gun sent successfully", 
        recipientCount: actualRecipientCount,
        potentialRecipients: userIds.length,
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
      const userId = (req.user as any).claims.sub;
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

  // Toggle flare status for an event
  app.post('/api/events/:id/flare-status', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = req.params.id;
      const userId = (req.user as any).claims.sub;
      const { status } = req.body; // 'active' or 'inactive'

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: "Invalid flare status. Use 'active' or 'inactive'." });
      }

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
        return res.status(403).json({ message: "Not authorized to manage flare status for this event" });
      }

      if (status === 'active') {
        await storage.activateFlareStatus(eventId, userId);
      } else {
        await storage.deactivateFlareStatus(eventId);
      }

      res.json({ 
        message: `Flare status set to ${status}`,
        eventId,
        flareStatus: status
      });
    } catch (error) {
      console.error("Error updating flare status:", error);
      res.status(500).json({ message: "Failed to update flare status" });
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

      // Pass the authenticated user ID to exclude events from teams that have blocked them
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const events = await storage.searchFlareEvents(
        postcode as string, 
        parseInt(radius as string), 
        sport as string,
        userId // Pass user ID for blocking filter
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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
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
      const userId = (req.user as any).claims.sub;
      const { eventId } = req.params;

      const isFollowing = await storage.isUserFollowingEvent(userId, eventId);
      res.json({ isFollowing });
    } catch (error) {
      console.error("Error checking user event status:", error);
      res.status(500).json({ message: "Failed to check event status" });
    }
  });

  // Payment endpoints for Stripe holds/reserved payments
  
  // Create SetupIntent when user votes to attend (payment setup)
  app.post('/api/payments/setup-intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
      }

      // Get or create Stripe customer
      let user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { userId }
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, customerId);
      }

      // Create SetupIntent for future payments
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card']
      });

      // Store in database
      await storage.createEventPayment({
        eventId,
        userId,
        stripeCustomerId: customerId,
        setupIntentId: setupIntent.id,
        setupIntentStatus: setupIntent.status as "requires_payment_method" | "requires_confirmation" | "succeeded" | "canceled",
        status: 'setup_pending'
      });

      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error: any) {
      console.error('Setup intent error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Confirm SetupIntent and store payment method
  app.post('/api/payments/confirm-setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { eventId, setupIntentId } = req.body;

      if (!eventId || !setupIntentId) {
        return res.status(400).json({ error: "Event ID and Setup Intent ID are required" });
      }

      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      
      if (setupIntent.status === 'succeeded') {
        await storage.updateEventPaymentSetup(eventId, userId, {
          setupIntentStatus: 'succeeded',
          paymentMethodId: setupIntent.payment_method as string,
          status: 'setup_complete'
        });
        
        res.json({ success: true });
      } else {
        res.json({ success: false, status: setupIntent.status });
      }
    } catch (error: any) {
      console.error('Setup confirm error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create PaymentIntent with hold (48h before event)
  app.post('/api/payments/create-hold', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { eventId } = req.body;

      // Get event payment setup
      const eventPayment = await storage.getEventPayment(eventId, userId);
      if (!eventPayment || eventPayment.status !== 'setup_complete') {
        return res.status(400).json({ error: "Payment setup not complete" });
      }

      // Get event details for amount
      const event = await storage.getEventById(eventId);
      if (!event || !event.paymentRequired || !event.maxPlayerPayment) {
        return res.status(400).json({ error: "Event payment not configured" });
      }

      const holdAmount = Math.round(parseFloat(event.maxPlayerPayment) * 100); // Convert to cents

      // Create PaymentIntent with manual capture
      const paymentIntent = await stripe.paymentIntents.create({
        amount: holdAmount,
        currency: 'gbp',
        customer: eventPayment.stripeCustomerId!,
        payment_method: eventPayment.paymentMethodId!,
        off_session: true,
        capture_method: 'manual',
        confirmation_method: 'automatic',
        confirm: true,
        metadata: { eventId, userId }
      });

      // Update event payment record
      await storage.updateEventPaymentHold(eventId, userId, {
        paymentIntentId: paymentIntent.id,
        paymentIntentStatus: paymentIntent.status,
        holdAmount: event.maxPlayerPayment,
        status: 'hold_created',
        holdCreatedAt: new Date()
      });

      res.json({ success: true, paymentIntentId: paymentIntent.id });
    } catch (error: any) {
      console.error('Create hold error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Capture payment post-event (partial or full)
  app.post('/api/payments/capture', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { eventId, finalAmount } = req.body;

      if (!eventId || !finalAmount) {
        return res.status(400).json({ error: "Event ID and final amount are required" });
      }

      // Check user has admin permissions for this event
      const userRole = await storage.getUserEventRole(userId, eventId);
      if (!userRole || !['owner', 'admin', 'captain'].includes(userRole)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Get all attendees with payment holds
      const attendees = await storage.getEventAttendeesWithPayments(eventId);
      const results = [];

      for (const attendee of attendees) {
        if (attendee.eventPayment && attendee.eventPayment.paymentIntentId && attendee.eventPayment.status === 'hold_created') {
          try {
            const captureAmount = Math.round(parseFloat(finalAmount) * 100); // Convert to cents
            
            const paymentIntent = await stripe.paymentIntents.capture(
              attendee.eventPayment.paymentIntentId,
              { amount_to_capture: captureAmount }
            );

            // Update payment record
            await storage.updateEventPaymentCapture(eventId, attendee.userId, {
              paymentIntentStatus: paymentIntent.status,
              finalAmount: finalAmount,
              status: 'captured',
              capturedAt: new Date()
            });

            results.push({ userId: attendee.userId, success: true });
          } catch (error: any) {
            console.error(`Capture failed for user ${attendee.userId}:`, error);
            results.push({ userId: attendee.userId, success: false, error: error.message });
          }
        }
      }

      // Update event payment status
      await storage.updateEventPaymentStatus(eventId, 'captured');

      res.json({ results, totalProcessed: results.length });
    } catch (error: any) {
      console.error('Capture payments error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel payment hold (when user unvotes)
  app.post('/api/payments/cancel-hold', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
      }

      const eventPayment = await storage.getEventPayment(eventId, userId);
      if (!eventPayment || !eventPayment.paymentIntentId) {
        return res.status(400).json({ error: "No payment hold found" });
      }

      // Cancel the PaymentIntent
      await stripe.paymentIntents.cancel(eventPayment.paymentIntentId);

      // Update payment record
      await storage.updateEventPaymentCancel(eventId, userId, {
        paymentIntentStatus: 'canceled',
        status: 'cancelled'
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Cancel hold error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get payment status for event
  app.get('/api/payments/event/:eventId/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { eventId } = req.params;

      const eventPayment = await storage.getEventPayment(eventId, userId);
      const event = await storage.getEventById(eventId);

      res.json({
        event: {
          paymentRequired: event?.paymentRequired || false,
          maxPlayerPayment: event?.maxPlayerPayment || null,
          paymentStatus: event?.paymentStatus || 'none'
        },
        userPayment: eventPayment ? {
          status: eventPayment.status,
          setupComplete: eventPayment.status === 'setup_complete' || eventPayment.status === 'hold_created' || eventPayment.status === 'captured',
          holdCreated: eventPayment.status === 'hold_created' || eventPayment.status === 'captured',
          captured: eventPayment.status === 'captured'
        } : null
      });
    } catch (error: any) {
      console.error('Get payment status error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Payment Method Management Endpoints
  
  // Get user's saved payment methods
  app.get('/api/payment-methods', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      
      // Get user with Stripe customer ID
      const user = await storage.getUserById(userId);
      if (!user?.stripeCustomerId) {
        return res.json([]);
      }

      // Fetch payment methods from Stripe
      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
      });

      // Get user's default payment method from customer
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      const defaultPaymentMethodId = (customer as any).invoice_settings?.default_payment_method;

      const formattedMethods = paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year,
        } : undefined,
        isDefault: pm.id === defaultPaymentMethodId
      }));

      res.json(formattedMethods);
    } catch (error: any) {
      console.error('Get payment methods error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Setup new payment method
  app.post('/api/payment-methods/setup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      
      // Get or create Stripe customer
      let user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { userId }
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(userId, customerId);
      }

      // Create SetupIntent for payment method setup
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        usage: 'off_session',
        payment_method_types: ['card']
      });

      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error: any) {
      console.error('Payment method setup error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete payment method
  app.delete('/api/payment-methods/:paymentMethodId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { paymentMethodId } = req.params;

      // Verify ownership by checking if it belongs to user's customer
      const user = await storage.getUserById(userId);
      if (!user?.stripeCustomerId) {
        return res.status(404).json({ error: "User has no payment methods" });
      }

      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== user.stripeCustomerId) {
        return res.status(403).json({ error: "Not authorized to delete this payment method" });
      }

      // Detach the payment method
      await stripe.paymentMethods.detach(paymentMethodId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete payment method error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set default payment method
  app.put('/api/payment-methods/:paymentMethodId/default', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { paymentMethodId } = req.params;

      const user = await storage.getUserById(userId);
      if (!user?.stripeCustomerId) {
        return res.status(404).json({ error: "User has no payment methods" });
      }

      // Verify ownership
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== user.stripeCustomerId) {
        return res.status(403).json({ error: "Not authorized to modify this payment method" });
      }

      // Set as default payment method
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Set default payment method error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get payments history for user
  app.get('/api/payments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const payments = await storage.getUserPayments(userId);
      res.json(payments);
    } catch (error: any) {
      console.error('Get payments error:', error);
      res.status(500).json({ error: error.message });
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

  // Platform charges management routes
  app.get('/api/platform-charges', isAuthenticated, async (req: any, res) => {
    try {
      const charges = await storage.getPlatformCharges();
      res.json(charges);
    } catch (error) {
      console.error("Error fetching platform charges:", error);
      res.status(500).json({ message: "Failed to fetch platform charges" });
    }
  });

  app.put('/api/platform-charges/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { platformChargeSchema } = await import('@shared/schema');
      const chargeData = platformChargeSchema.parse(req.body);
      
      const updatedCharge = await storage.updatePlatformCharge(id, chargeData);
      res.json(updatedCharge);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors
        });
      }
      console.error("Error updating platform charge:", error);
      res.status(500).json({ message: "Failed to update platform charge" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
