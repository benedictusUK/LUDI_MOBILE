import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertTeamSchema, 
  insertEventSchema, 
  insertNotificationSchema,
  insertEventAttendanceSchema,
  insertPaymentSchema,
  insertNotificationPreferencesSchema 
} from "@shared/schema";
import { z } from "zod";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-06-30.basil",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

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
      const teamData = insertTeamSchema.parse({
        ...req.body,
        ownerId: userId,
      });
      
      const team = await storage.createTeam(teamData, userId);
      res.json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(400).json({ message: "Failed to create team" });
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
    } catch (error) {
      console.error("Error updating team:", error);
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
    } catch (error) {
      console.error("Error creating event:", error);
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

  app.put('/api/events/:id', isAuthenticated, async (req, res) => {
    try {
      const updates = req.body;
      const event = await storage.updateEvent(req.params.id, updates);
      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
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
