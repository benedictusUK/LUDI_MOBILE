import {
  users,
  teams,
  events,
  teamMemberships,
  eventTeams,
  notifications,
  eventAttendance,
  payments,
  notificationPreferences,
  activityLogs,
  type User,
  type UpsertUser,
  type Team,
  type InsertTeam,
  type Event,
  type InsertEvent,
  type TeamMembership,
  type EventTeam,
  type Notification,
  type InsertNotification,
  type EventAttendance,
  type InsertEventAttendance,
  type Payment,
  type InsertPayment,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type ActivityLog,
  type InsertActivityLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User>;

  // Team operations
  createTeam(teamData: InsertTeam, ownerId: string): Promise<Team>;
  getTeam(id: string): Promise<Team | undefined>;
  getTeamByName(name: string): Promise<Team | undefined>;
  getUserTeams(userId: string): Promise<(Team & { role: string; memberCount: number })[]>;
  addTeamMember(teamId: string, userId: string, role?: string): Promise<TeamMembership>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  getTeamMembers(teamId: string): Promise<(TeamMembership & { user: User })[]>;
  updateTeam(id: string, updates: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  getUserTeam(userId: string, teamId: string): Promise<TeamMembership | undefined>;

  // Event operations
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: string): Promise<Event | undefined>;
  getUserEvents(userId: string): Promise<Event[]>;
  getTeamEvents(teamId: string): Promise<Event[]>;
  updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
  addEventTeam(eventId: string, teamId: string): Promise<EventTeam>;

  // Event attendance operations
  recordAttendance(attendance: InsertEventAttendance): Promise<EventAttendance>;
  getEventAttendance(eventId: string): Promise<(EventAttendance & { user: User })[]>;
  getUserAttendance(userId: string, eventId: string): Promise<EventAttendance | undefined>;

  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  getUserPayments(userId: string): Promise<Payment[]>;
  getEventPayments(eventId: string): Promise<(Payment & { user: User })[]>;
  updatePaymentStatus(paymentId: string, status: string, stripePaymentIntentId?: string): Promise<Payment>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;

  // Notification preferences
  getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined>;
  upsertNotificationPreferences(preferences: InsertNotificationPreferences): Promise<NotificationPreferences>;

  // Dashboard operations
  getDashboardStats(userId: string): Promise<{
    upcomingEvents: number;
    activeTeams: number;
    totalPlayers: number;
    unreadNotifications: number;
  }>;

  // Activity log operations
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  getEventActivityLogs(eventId: string): Promise<(ActivityLog & { user: User })[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User> {
    const updates: any = { stripeCustomerId, updatedAt: new Date() };
    if (stripeSubscriptionId) {
      updates.stripeSubscriptionId = stripeSubscriptionId;
    }
    
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Team operations
  async createTeam(teamData: InsertTeam, ownerId: string): Promise<Team> {
    const teamId = randomUUID();
    const inviteCode = randomUUID().slice(0, 8);
    
    const [newTeam] = await db
      .insert(teams)
      .values({
        ...teamData,
        id: teamId,
        ownerId,
        inviteCode,
      })
      .returning();

    // Add the creator as team owner/admin
    await db.insert(teamMemberships).values({
      teamId: teamId,
      userId: ownerId,
      role: "admin",
    });

    return newTeam;
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async getTeamByName(name: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.name, name));
    return team;
  }

  async getUserTeams(userId: string): Promise<(Team & { role: string; memberCount: number })[]> {
    const result = await db
      .select({
        id: teams.id,
        name: teams.name,
        sports: teams.sports,
        description: teams.description,
        color: teams.color,
        maxPlayers: teams.maxPlayers,
        isPrivate: teams.isPrivate,
        requiresApproval: teams.requiresApproval,
        ownerId: teams.ownerId,
        inviteCode: teams.inviteCode,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        role: teamMemberships.role,
        memberCount: count(teamMemberships.id),
      })
      .from(teams)
      .innerJoin(teamMemberships, eq(teams.id, teamMemberships.teamId))
      .where(eq(teamMemberships.userId, userId))
      .groupBy(teams.id, teamMemberships.role);

    return result;
  }

  async addTeamMember(teamId: string, userId: string, role = "member"): Promise<TeamMembership> {
    const [membership] = await db
      .insert(teamMemberships)
      .values({
        teamId,
        userId,
        role,
      })
      .returning();
    return membership;
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await db
      .delete(teamMemberships)
      .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, userId)));
  }

  async getTeamMembers(teamId: string): Promise<(TeamMembership & { user: User })[]> {
    const result = await db
      .select({
        id: teamMemberships.id,
        teamId: teamMemberships.teamId,
        userId: teamMemberships.userId,
        role: teamMemberships.role,
        joinedAt: teamMemberships.joinedAt,
        user: users,
      })
      .from(teamMemberships)
      .innerJoin(users, eq(teamMemberships.userId, users.id))
      .where(eq(teamMemberships.teamId, teamId));

    return result;
  }

  async updateTeam(id: string, updates: Partial<InsertTeam>): Promise<Team> {
    const [team] = await db
      .update(teams)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();
    return team;
  }

  async deleteTeam(id: string): Promise<void> {
    // Delete all team memberships first
    await db.delete(teamMemberships).where(eq(teamMemberships.teamId, id));
    
    // Delete all event teams relationships
    await db.delete(eventTeams).where(eq(eventTeams.teamId, id));
    
    // Finally delete the team
    await db.delete(teams).where(eq(teams.id, id));
  }

  async getUserTeam(userId: string, teamId: string): Promise<TeamMembership | undefined> {
    const [membership] = await db
      .select()
      .from(teamMemberships)
      .where(and(eq(teamMemberships.userId, userId), eq(teamMemberships.teamId, teamId)));
    return membership;
  }

  // Event operations
  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    
    // Add event-team associations for secondary teams
    if (event.secondaryTeamIds && event.secondaryTeamIds.length > 0) {
      const eventTeamAssociations = event.secondaryTeamIds.map(teamId => ({
        eventId: newEvent.id,
        teamId: teamId,
        status: 'accepted' as const
      }));
      await db.insert(eventTeams).values(eventTeamAssociations);
    }
    
    return newEvent;
  }

  async getEvent(id: string): Promise<any | undefined> {
    const [result] = await db
      .select({
        // Event fields
        eventId: events.id,
        eventName: events.name,
        eventDescription: events.requirements,
        eventStartDate: events.startDate,
        eventEndDate: events.endDate,
        eventStartTime: events.startTime,
        eventEndTime: events.endTime,
        eventLocation: events.location,
        eventMaxParticipants: events.participants,
        eventCost: events.cost,
        eventCreatedById: events.createdById,
        eventPrimaryTeamId: events.primaryTeamId,
        eventCreatedAt: events.createdAt,
        eventUpdatedAt: events.updatedAt,
        // Team fields
        teamId: teams.id,
        teamName: teams.name,
        teamColor: teams.color,
        teamOwnerId: teams.ownerId,
        teamMaxPlayers: teams.maxPlayers,
        teamCreatedAt: teams.createdAt,
        teamUpdatedAt: teams.updatedAt
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .where(eq(events.id, id))
      .limit(1);
    
    if (!result) return undefined;
    
    return {
      id: result.eventId,
      name: result.eventName,
      requirements: result.eventDescription,
      startDate: result.eventStartDate,
      endDate: result.eventEndDate,
      startTime: result.eventStartTime,
      endTime: result.eventEndTime,
      location: result.eventLocation,
      participants: result.eventMaxParticipants,
      cost: result.eventCost,
      createdById: result.eventCreatedById,
      primaryTeamId: result.eventPrimaryTeamId,
      createdAt: result.eventCreatedAt,
      updatedAt: result.eventUpdatedAt,
      primaryTeam: {
        id: result.teamId,
        name: result.teamName,
        color: result.teamColor,
        ownerId: result.teamOwnerId,
        maxPlayers: result.teamMaxPlayers,
        createdAt: result.teamCreatedAt,
        updatedAt: result.teamUpdatedAt
      }
    };
  }

  async getUserEvents(userId: string): Promise<any[]> {
    // Get events where user's team is the primary team
    const primaryTeamEvents = await db
      .select({ 
        event: events,
        primaryTeam: teams
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .innerJoin(teamMemberships, eq(events.primaryTeamId, teamMemberships.teamId))
      .where(eq(teamMemberships.userId, userId));

    // Get events where user's team is a secondary team
    const secondaryTeamEvents = await db
      .select({ 
        event: events,
        primaryTeam: teams
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .innerJoin(eventTeams, eq(events.id, eventTeams.eventId))
      .innerJoin(teamMemberships, eq(eventTeams.teamId, teamMemberships.teamId))
      .where(eq(teamMemberships.userId, userId));

    // Combine and deduplicate events
    const allEvents = [...primaryTeamEvents, ...secondaryTeamEvents];
    const uniqueEvents = allEvents.filter((eventData, index, self) => 
      index === self.findIndex(e => e.event.id === eventData.event.id)
    );

    // Sort by start date descending
    uniqueEvents.sort((a, b) => new Date(b.event.startDate).getTime() - new Date(a.event.startDate).getTime());

    // Return events with primary team data
    return uniqueEvents.map(result => ({
      ...result.event,
      primaryTeam: result.primaryTeam
    }));
  }

  async getTeamEvents(teamId: string): Promise<any[]> {
    const teamEvents = await db
      .select({ 
        event: events,
        primaryTeam: teams
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .innerJoin(eventTeams, eq(events.id, eventTeams.eventId))
      .where(eq(eventTeams.teamId, teamId))
      .orderBy(desc(events.startDate));

    return teamEvents.map(result => ({
      ...result.event,
      primaryTeam: result.primaryTeam
    }));
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event> {
    const [event] = await db
      .update(events)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    
    // Update event-team associations for secondary teams if provided
    if (updates.secondaryTeamIds !== undefined) {
      // Remove existing secondary team associations (not primary team)
      await db.delete(eventTeams).where(eq(eventTeams.eventId, id));
      
      // Add new secondary team associations
      if (updates.secondaryTeamIds.length > 0) {
        const eventTeamAssociations = updates.secondaryTeamIds.map(teamId => ({
          eventId: id,
          teamId: teamId,
          status: 'accepted' as const
        }));
        await db.insert(eventTeams).values(eventTeamAssociations);
      }
    }
    
    return event;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async addEventTeam(eventId: string, teamId: string): Promise<EventTeam> {
    const [eventTeam] = await db
      .insert(eventTeams)
      .values({
        eventId,
        teamId,
        status: "invited",
      })
      .returning();
    return eventTeam;
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    return userNotifications;
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  // Event attendance operations
  async getEventAttendance(eventId: string): Promise<any[]> {
    const attendanceRecords = await db
      .select({
        attendance: eventAttendance,
        user: users
      })
      .from(eventAttendance)
      .innerJoin(users, eq(eventAttendance.userId, users.id))
      .where(eq(eventAttendance.eventId, eventId))
      .orderBy(desc(eventAttendance.votedAt));

    return attendanceRecords.map(record => ({
      ...record.attendance,
      user: record.user
    }));
  }

  async voteOnEvent(eventId: string, userId: string, status: "attending" | "not_attending"): Promise<any> {
    // Use upsert to handle both insert and update in single query
    const [vote] = await db
      .insert(eventAttendance)
      .values({
        eventId,
        userId,
        status,
        votedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [eventAttendance.eventId, eventAttendance.userId],
        set: {
          status,
          votedAt: new Date()
        }
      })
      .returning();

    // Log the activity asynchronously (don't wait for it)
    this.logActivity(eventId, userId, "voted", null, status).catch(err => 
      console.error("Failed to log activity:", err)
    );
      
    return vote;
  }

  async removeVote(eventId: string, userId: string): Promise<void> {
    // Remove the vote directly - if it doesn't exist, this will just do nothing
    await db
      .delete(eventAttendance)
      .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, userId)));

    // Log the unvote activity asynchronously
    this.logActivity(eventId, userId, "unvoted", null, null).catch(err => 
      console.error("Failed to log unvote activity:", err)
    );
  }




  async recordAttendance(attendance: InsertEventAttendance): Promise<EventAttendance> {
    const [newAttendance] = await db
      .insert(eventAttendance)
      .values({
        ...attendance,
        votedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [eventAttendance.eventId, eventAttendance.userId],
        set: {
          status: attendance.status,
          votedAt: new Date(),
        },
      })
      .returning();
    return newAttendance;
  }

  async getUserAttendance(userId: string, eventId: string): Promise<EventAttendance | undefined> {
    const [attendance] = await db
      .select()
      .from(eventAttendance)
      .where(and(eq(eventAttendance.userId, userId), eq(eventAttendance.eventId, eventId)));
    return attendance;
  }

  // Payment operations
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async getUserPayments(userId: string): Promise<Payment[]> {
    const userPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));

    return userPayments;
  }

  async getEventPayments(eventId: string): Promise<(Payment & { user: User })[]> {
    const result = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        eventId: payments.eventId,
        teamId: payments.teamId,
        amount: payments.amount,
        status: payments.status,
        dueDate: payments.dueDate,
        paidAt: payments.paidAt,
        stripePaymentIntentId: payments.stripePaymentIntentId,
        type: payments.type,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        user: users,
      })
      .from(payments)
      .innerJoin(users, eq(payments.userId, users.id))
      .where(eq(payments.eventId, eventId));

    return result;
  }

  async updatePaymentStatus(paymentId: string, status: string, stripePaymentIntentId?: string): Promise<Payment> {
    const updates: any = { status, updatedAt: new Date() };
    if (status === "paid") {
      updates.paidAt = new Date();
    }
    if (stripePaymentIntentId) {
      updates.stripePaymentIntentId = stripePaymentIntentId;
    }

    const [payment] = await db
      .update(payments)
      .set(updates)
      .where(eq(payments.id, paymentId))
      .returning();
    return payment;
  }

  // Notification preferences
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return preferences;
  }

  async upsertNotificationPreferences(preferences: InsertNotificationPreferences): Promise<NotificationPreferences> {
    const [newPreferences] = await db
      .insert(notificationPreferences)
      .values(preferences)
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          ...preferences,
          updatedAt: new Date(),
        },
      })
      .returning();
    return newPreferences;
  }

  // Dashboard operations
  async getDashboardStats(userId: string): Promise<{
    upcomingEvents: number;
    activeTeams: number;
    totalPlayers: number;
    unreadNotifications: number;
  }> {
    // Get upcoming events for user's teams
    const upcomingEvents = await db
      .select({ count: count() })
      .from(events)
      .innerJoin(eventTeams, eq(events.id, eventTeams.eventId))
      .innerJoin(teamMemberships, eq(eventTeams.teamId, teamMemberships.teamId))
      .where(
        and(
          eq(teamMemberships.userId, userId),
          sql`${events.startDate} >= CURRENT_DATE`
        )
      );

    // Get active teams count
    const activeTeams = await db
      .select({ count: count() })
      .from(teamMemberships)
      .where(eq(teamMemberships.userId, userId));

    // Get total players in user's teams
    const totalPlayers = await db
      .select({ count: count(teamMemberships.id) })
      .from(teamMemberships)
      .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
      .where(eq(teams.ownerId, userId));

    // Get unread notifications
    const unreadNotifications = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );

    return {
      upcomingEvents: upcomingEvents[0]?.count || 0,
      activeTeams: activeTeams[0]?.count || 0,
      totalPlayers: totalPlayers[0]?.count || 0,
      unreadNotifications: unreadNotifications[0]?.count || 0,
    };
  }

  // Activity log operations
  async logActivity(eventId: string, userId: string, action: string, previousStatus: string | null, newStatus: string | null): Promise<void> {
    await db.insert(activityLogs).values({
      eventId,
      userId,
      action,
      previousStatus,
      newStatus,
      timestamp: new Date(),
      ipAddress: null,
      userAgent: null
    });
  }

  async logActivityRecord(activity: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLogs)
      .values({
        ...activity,
        timestamp: new Date(),
      })
      .returning();
    return log;
  }

  async getEventActivityLogs(eventId: string): Promise<(ActivityLog & { user: User })[]> {
    const result = await db
      .select({
        id: activityLogs.id,
        eventId: activityLogs.eventId,
        userId: activityLogs.userId,
        action: activityLogs.action,
        previousStatus: activityLogs.previousStatus,
        newStatus: activityLogs.newStatus,
        timestamp: activityLogs.timestamp,
        ipAddress: activityLogs.ipAddress,
        userAgent: activityLogs.userAgent,
        user: users
      })
      .from(activityLogs)
      .innerJoin(users, eq(activityLogs.userId, users.id))
      .where(eq(activityLogs.eventId, eventId))
      .orderBy(desc(activityLogs.timestamp));

    return result;
  }

  async getEventPotentialPlayers(eventId: string): Promise<User[]> {
    // Get the event to find associated team - use primaryTeamId instead of teamId
    const [event] = await db
      .select({ primaryTeamId: events.primaryTeamId })
      .from(events)
      .where(eq(events.id, eventId));

    if (!event || !event.primaryTeamId) {
      return [];
    }

    // Get all team members
    const teamMembers = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        username: users.username,
        gender: users.gender,
        ukMobileNumber: users.ukMobileNumber,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt
      })
      .from(teamMemberships)
      .innerJoin(users, eq(teamMemberships.userId, users.id))
      .where(eq(teamMemberships.teamId, event.primaryTeamId));

    // Get users who have voted for this event
    const votedUserIds = await db
      .select({ userId: eventAttendance.userId })
      .from(eventAttendance)
      .where(eq(eventAttendance.eventId, eventId));

    const votedUserIdSet = new Set(votedUserIds.map(v => v.userId));

    // Return team members who haven't voted - map to proper User format
    return teamMembers
      .filter(member => !votedUserIdSet.has(member.userId))
      .map(member => ({
        id: member.userId,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        profileImageUrl: member.profileImageUrl,
        username: member.username,
        gender: member.gender,
        ukMobileNumber: member.ukMobileNumber,
        stripeCustomerId: member.stripeCustomerId,
        stripeSubscriptionId: member.stripeSubscriptionId,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      }));
  }
}

export const storage = new DatabaseStorage();
