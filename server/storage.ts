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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User>;

  // Team operations
  createTeam(team: InsertTeam): Promise<Team>;
  getTeam(id: string): Promise<Team | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
  async createTeam(team: InsertTeam): Promise<Team> {
    const teamId = randomUUID();
    const inviteCode = randomUUID().slice(0, 8);
    
    const [newTeam] = await db
      .insert(teams)
      .values({
        ...team,
        id: teamId,
        inviteCode,
      })
      .returning();

    // Add the creator as team owner/admin
    await db.insert(teamMemberships).values({
      teamId: teamId,
      userId: team.ownerId,
      role: "admin",
    });

    return newTeam;
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async getUserTeams(userId: string): Promise<(Team & { role: string; memberCount: number })[]> {
    const result = await db
      .select({
        id: teams.id,
        name: teams.name,
        sport: teams.sport,
        maxPlayers: teams.maxPlayers,
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
    return newEvent;
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getUserEvents(userId: string): Promise<Event[]> {
    const userEvents = await db
      .select({ event: events })
      .from(events)
      .innerJoin(eventTeams, eq(events.id, eventTeams.eventId))
      .innerJoin(teamMemberships, eq(eventTeams.teamId, teamMemberships.teamId))
      .where(eq(teamMemberships.userId, userId))
      .orderBy(desc(events.startDate));

    return userEvents.map(result => result.event);
  }

  async getTeamEvents(teamId: string): Promise<Event[]> {
    const teamEvents = await db
      .select({ event: events })
      .from(events)
      .innerJoin(eventTeams, eq(events.id, eventTeams.eventId))
      .where(eq(eventTeams.teamId, teamId))
      .orderBy(desc(events.startDate));

    return teamEvents.map(result => result.event);
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event> {
    const [event] = await db
      .update(events)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
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

  async getEventAttendance(eventId: string): Promise<(EventAttendance & { user: User })[]> {
    const result = await db
      .select({
        id: eventAttendance.id,
        eventId: eventAttendance.eventId,
        userId: eventAttendance.userId,
        status: eventAttendance.status,
        votedAt: eventAttendance.votedAt,
        createdAt: eventAttendance.createdAt,
        user: users,
      })
      .from(eventAttendance)
      .innerJoin(users, eq(eventAttendance.userId, users.id))
      .where(eq(eventAttendance.eventId, eventId));

    return result;
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
}

export const storage = new DatabaseStorage();
