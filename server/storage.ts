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
  blockedMembers,
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
  type BlockedMember,
  type InsertBlockedMember,
  type ProfileCompletion,
  type UpdateProfile,
  flareResponses,
  type FlareResponse,
  type InsertFlareResponse,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, or, notInArray } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User>;
  updateUserProfile(userId: string, profileData: UpdateProfile): Promise<User>;
  completeUserProfile(userId: string, profileData: ProfileCompletion): Promise<User>;
  checkUsernameAvailability(username: string, excludeUserId?: string): Promise<boolean>;

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

  // Team search and join operations
  searchTeams(query: string, userId: string): Promise<(Team & { memberCount: number; isMember: boolean })[]>;
  requestToJoinTeam(teamId: string, userId: string): Promise<void>;
  joinTeam(teamId: string, userId: string): Promise<TeamMembership>;
  
  // Member management operations
  updateMemberRole(teamId: string, userId: string, newRole: string, updatedById: string): Promise<TeamMembership>;
  blockMember(teamId: string, userId: string, blockedById: string, reason?: string): Promise<BlockedMember>;
  unblockMember(teamId: string, userId: string): Promise<void>;
  getBlockedMembers(teamId: string): Promise<(BlockedMember & { user: User; blockedBy: User })[]>;
  isUserBlocked(teamId: string, userId: string): Promise<boolean>;
  
  // Join request management
  approveJoinRequest(teamId: string, userId: string, approverId: string): Promise<TeamMembership>;
  rejectJoinRequest(teamId: string, userId: string, rejectedById: string): Promise<void>;
  getTeamAdmins(teamId: string): Promise<User[]>;

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
      .values([userData])
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

  async updateUserProfile(userId: string, profileData: UpdateProfile): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...profileData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async completeUserProfile(userId: string, profileData: ProfileCompletion): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...profileData,
        profileCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async checkUsernameAvailability(username: string, excludeUserId?: string): Promise<boolean> {
    let query;
    
    if (excludeUserId) {
      // Check if username exists for users other than the excluded user
      query = db.select().from(users).where(
        and(eq(users.username, username), sql`${users.id} != ${excludeUserId}`)
      );
    } else {
      query = db.select().from(users).where(eq(users.username, username));
    }
    
    const [existingUser] = await query;
    return !existingUser;
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
        gender: teams.gender,
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
    if (event.secondaryTeamIds && Array.isArray(event.secondaryTeamIds) && event.secondaryTeamIds.length > 0) {
      const eventTeamAssociations = event.secondaryTeamIds.map((teamId: string) => ({
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
        event: events,
        primaryTeam: teams
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .where(eq(events.id, id))
      .limit(1);
    
    if (!result) return undefined;
    
    return {
      ...result.event,
      primaryTeam: result.primaryTeam
    };
  }

  async getUserEvents(userId: string): Promise<any[]> {
    // Get events where user's team is the primary team
    const primaryTeamEvents = await db
      .select({ 
        event: events,
        primaryTeam: teams,
        userAttendance: eventAttendance
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .innerJoin(teamMemberships, eq(events.primaryTeamId, teamMemberships.teamId))
      .leftJoin(eventAttendance, and(
        eq(eventAttendance.eventId, events.id),
        eq(eventAttendance.userId, userId)
      ))
      .where(eq(teamMemberships.userId, userId));

    // Get events where user's team is a secondary team
    const secondaryTeamEvents = await db
      .select({ 
        event: events,
        primaryTeam: teams,
        userAttendance: eventAttendance
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .innerJoin(eventTeams, eq(events.id, eventTeams.eventId))
      .innerJoin(teamMemberships, eq(eventTeams.teamId, teamMemberships.teamId))
      .leftJoin(eventAttendance, and(
        eq(eventAttendance.eventId, events.id),
        eq(eventAttendance.userId, userId)
      ))
      .where(eq(teamMemberships.userId, userId));

    // Combine and deduplicate events
    const allEvents = [...primaryTeamEvents, ...secondaryTeamEvents];
    const uniqueEvents = allEvents.filter((eventData, index, self) => 
      index === self.findIndex(e => e.event.id === eventData.event.id)
    );

    // Sort by start date descending
    uniqueEvents.sort((a, b) => new Date(b.event.startDate).getTime() - new Date(a.event.startDate).getTime());

    // Return events with primary team data and user attendance
    return uniqueEvents.map(result => ({
      ...result.event,
      primaryTeam: result.primaryTeam,
      userAttendance: result.userAttendance
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
      if (updates.secondaryTeamIds && updates.secondaryTeamIds.length > 0) {
        const eventTeamAssociations = updates.secondaryTeamIds.map((teamId: string) => ({
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
    this.logActivity({
      eventId,
      userId,
      action: "voted",
      previousStatus: null,
      newStatus: status
    }).catch(err => 
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
    this.logActivity({
      eventId,
      userId,
      action: "unvoted",
      previousStatus: null,
      newStatus: null
    }).catch(err => 
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
      .selectDistinct({ userId: teamMemberships.userId })
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
      totalPlayers: totalPlayers.length,
      unreadNotifications: unreadNotifications[0]?.count || 0,
    };
  }

  // Activity log operations
  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
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
        phoneNumber: users.phoneNumber,
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
        phoneNumber: member.phoneNumber,
        dateOfBirth: '', // Not selected in query, using empty string as default
        postcode: '', // Not selected in query, using empty string as default
        gender: member.gender,
        sportsInterests: [], // Not selected in query, using empty array as default
        travelRadius: 10, // Not selected in query, using default value
        stripeCustomerId: member.stripeCustomerId,
        stripeSubscriptionId: member.stripeSubscriptionId,
        profileCompletedAt: null, // Not selected in query
        createdAt: member.createdAt,
        updatedAt: member.updatedAt
      }));
  }

  // Team search and join operations
  async searchTeams(query: string, userId: string): Promise<(Team & { memberCount: number; isMember: boolean })[]> {
    const searchResults = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        sports: teams.sports,
        color: teams.color,
        gender: teams.gender,
        isPrivate: teams.isPrivate,
        requiresApproval: teams.requiresApproval,
        maxPlayers: teams.maxPlayers,
        ownerId: teams.ownerId,
        inviteCode: teams.inviteCode,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        memberCount: count(teamMemberships.id),
      })
      .from(teams)
      .leftJoin(teamMemberships, eq(teams.id, teamMemberships.teamId))
      .where(
        and(
          eq(teams.isPrivate, false), // Only search public teams
          sql`LOWER(${teams.name}) LIKE LOWER('%' || ${query} || '%')`
        )
      )
      .groupBy(teams.id)
      .orderBy(teams.name);

    // Check membership for each team
    const resultsWithMembership = [];
    for (const team of searchResults) {
      const membership = await this.getUserTeam(userId, team.id);
      resultsWithMembership.push({
        ...team,
        isMember: !!membership,
      });
    }

    return resultsWithMembership;
  }

  async requestToJoinTeam(teamId: string, userId: string): Promise<void> {
    // Check if user is blocked
    const isBlocked = await this.isUserBlocked(teamId, userId);
    if (isBlocked) {
      throw new Error("You are blocked from joining this team");
    }

    // Create a notification for the team owner and all admins
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const admins = await this.getTeamAdmins(teamId);
    
    // Send notification to team owner and all admins
    for (const admin of admins) {
      await this.createNotification({
        userId: admin.id,
        type: "team_join_request",
        title: "New Team Join Request",
        message: `${user.firstName} ${user.lastName} wants to join ${team.name}`,
        relatedId: teamId,
        isRead: false,
      });
    }
  }

  async joinTeam(teamId: string, userId: string): Promise<TeamMembership> {
    // Check if user is blocked
    const isBlocked = await this.isUserBlocked(teamId, userId);
    if (isBlocked) {
      throw new Error("You are blocked from joining this team");
    }

    // Check if user is already a member
    const existingMembership = await this.getUserTeam(userId, teamId);
    if (existingMembership) {
      throw new Error("User is already a member of this team");
    }

    // Check team capacity
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    if (team.maxPlayers) {
      const currentMembers = await this.getTeamMembers(teamId);
      if (currentMembers.length >= team.maxPlayers) {
        throw new Error("Team is at maximum capacity");
      }
    }

    // Add user to team
    return await this.addTeamMember(teamId, userId, "member");
  }

  // Member management operations
  async updateMemberRole(teamId: string, userId: string, newRole: string, updatedById: string): Promise<TeamMembership> {
    // Verify the updater has permission (owner or admin)
    const updaterMembership = await this.getUserTeam(updatedById, teamId);
    const team = await this.getTeam(teamId);
    
    if (!team || (!updaterMembership && team.ownerId !== updatedById) || 
        (updaterMembership && !["admin"].includes(updaterMembership.role) && team.ownerId !== updatedById)) {
      throw new Error("Not authorized to update member roles");
    }

    // Cannot demote the owner
    if (team.ownerId === userId && newRole !== "admin") {
      throw new Error("Cannot change owner role");
    }

    const [updatedMembership] = await db
      .update(teamMemberships)
      .set({ role: newRole })
      .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, userId)))
      .returning();

    return updatedMembership;
  }

  async blockMember(teamId: string, userId: string, blockedById: string, reason?: string): Promise<BlockedMember> {
    // Verify the blocker has permission (owner or admin)
    const blockerMembership = await this.getUserTeam(blockedById, teamId);
    const team = await this.getTeam(teamId);
    
    if (!team || (!blockerMembership && team.ownerId !== blockedById) || 
        (blockerMembership && !["admin"].includes(blockerMembership.role) && team.ownerId !== blockedById)) {
      throw new Error("Not authorized to block members");
    }

    // Cannot block the owner
    if (team.ownerId === userId) {
      throw new Error("Cannot block team owner");
    }

    // Remove from team if they are a member
    const membership = await this.getUserTeam(userId, teamId);
    if (membership) {
      await this.removeTeamMember(teamId, userId);
    }

    // Add to blocked list
    const [blockedMember] = await db
      .insert(blockedMembers)
      .values({
        teamId,
        userId,
        blockedById,
        reason,
      })
      .onConflictDoUpdate({
        target: [blockedMembers.teamId, blockedMembers.userId],
        set: {
          blockedById,
          reason,
          blockedAt: new Date(),
        },
      })
      .returning();

    return blockedMember;
  }

  async unblockMember(teamId: string, userId: string): Promise<void> {
    await db
      .delete(blockedMembers)
      .where(and(eq(blockedMembers.teamId, teamId), eq(blockedMembers.userId, userId)));
  }

  async getBlockedMembers(teamId: string): Promise<(BlockedMember & { user: User; blockedBy: User })[]> {
    const result = await db
      .select({
        id: blockedMembers.id,
        teamId: blockedMembers.teamId,
        userId: blockedMembers.userId,
        blockedById: blockedMembers.blockedById,
        reason: blockedMembers.reason,
        blockedAt: blockedMembers.blockedAt,
        user: users,
        blockedBy: {
          id: sql<string>`blocker.id`,
          email: sql<string>`blocker.email`,
          firstName: sql<string>`blocker.first_name`,
          lastName: sql<string>`blocker.last_name`,
          profileImageUrl: sql<string>`blocker.profile_image_url`,
          username: sql<string>`blocker.username`,
          phoneNumber: sql<string>`blocker.phone_number`,
          dateOfBirth: sql<string>`blocker.date_of_birth`,
          postcode: sql<string>`blocker.postcode`,
          gender: sql<string>`blocker.gender`,
          sportsInterests: sql<string[]>`blocker.sports_interests`,
          travelRadius: sql<number>`blocker.travel_radius`,
          stripeCustomerId: sql<string>`blocker.stripe_customer_id`,
          stripeSubscriptionId: sql<string>`blocker.stripe_subscription_id`,
          profileCompletedAt: sql<Date>`blocker.profile_completed_at`,
          createdAt: sql<Date>`blocker.created_at`,
          updatedAt: sql<Date>`blocker.updated_at`,
        },
      })
      .from(blockedMembers)
      .innerJoin(users, eq(blockedMembers.userId, users.id))
      .innerJoin(sql`${users} AS blocker`, sql`${blockedMembers.blockedById} = blocker.id`)
      .where(eq(blockedMembers.teamId, teamId))
      .orderBy(desc(blockedMembers.blockedAt));

    return result;
  }

  async isUserBlocked(teamId: string, userId: string): Promise<boolean> {
    const [blocked] = await db
      .select({ id: blockedMembers.id })
      .from(blockedMembers)
      .where(and(eq(blockedMembers.teamId, teamId), eq(blockedMembers.userId, userId)));
    
    return !!blocked;
  }

  async approveJoinRequest(teamId: string, userId: string, approverId: string): Promise<TeamMembership> {
    // Verify approver has permission
    const approverMembership = await this.getUserTeam(approverId, teamId);
    const team = await this.getTeam(teamId);
    
    if (!team || (!approverMembership && team.ownerId !== approverId) || 
        (approverMembership && !["admin"].includes(approverMembership.role) && team.ownerId !== approverId)) {
      throw new Error("Not authorized to approve join requests");
    }

    // Add user to team
    const membership = await this.joinTeam(teamId, userId);

    // Notify the user that their request was approved
    const user = await this.getUser(userId);
    if (user) {
      await this.createNotification({
        userId,
        type: "team_join_approved",
        title: "Join Request Approved",
        message: `Your request to join ${team.name} has been approved!`,
        relatedId: teamId,
        isRead: false,
      });
    }

    return membership;
  }

  async rejectJoinRequest(teamId: string, userId: string, rejectedById: string): Promise<void> {
    // Verify rejector has permission
    const rejectorMembership = await this.getUserTeam(rejectedById, teamId);
    const team = await this.getTeam(teamId);
    
    if (!team || (!rejectorMembership && team.ownerId !== rejectedById) || 
        (rejectorMembership && !["admin"].includes(rejectorMembership.role) && team.ownerId !== rejectedById)) {
      throw new Error("Not authorized to reject join requests");
    }

    // Notify the user that their request was rejected
    const user = await this.getUser(userId);
    if (user) {
      await this.createNotification({
        userId,
        type: "team_join_rejected",
        title: "Join Request Declined",
        message: `Your request to join ${team.name} has been declined.`,
        relatedId: teamId,
        isRead: false,
      });
    }
  }

  async getTeamAdmins(teamId: string): Promise<User[]> {
    const team = await this.getTeam(teamId);
    if (!team) {
      return [];
    }

    const adminMembers = await db
      .select({ user: users })
      .from(teamMemberships)
      .innerJoin(users, eq(teamMemberships.userId, users.id))
      .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.role, "admin")));

    const owner = await this.getUser(team.ownerId);
    const admins = adminMembers.map(m => m.user);
    
    if (owner && !admins.find(a => a.id === owner.id)) {
      admins.unshift(owner);
    }

    return admins;
  }
  // Flare gun operations
  async findNearbyUsers(eventId: string, sport: string, maxResults: number = 20): Promise<User[]> {
    // Get the event details to find the location/postcode
    const [event] = await db
      .select({ location: events.location, primaryTeamId: events.primaryTeamId })
      .from(events)
      .where(eq(events.id, eventId));

    if (!event) return [];

    // Find users who:
    // 1. Have this sport in their interests
    // 2. Are not already in any team (to avoid duplicates with team search)
    // 3. Are within travel radius (simplified - this could be enhanced with actual distance calculation)
    const nearbyUsers = await db
      .select()
      .from(users)
      .where(
        and(
          sql`${sport} = ANY(${users.sportsInterests})`,
          // Exclude users who are already team members
          sql`${users.id} NOT IN (SELECT user_id FROM team_memberships)`,
          // Only include users who have completed their profile
          sql`${users.profileCompletedAt} IS NOT NULL`
        )
      )
      .limit(maxResults);

    return nearbyUsers;
  }

  async sendFlareNotifications(eventId: string, userIds: string[]): Promise<void> {
    // Get event details for notification
    const [event] = await db
      .select({ name: events.name, location: events.location, startDate: events.startDate, startTime: events.startTime })
      .from(events)
      .where(eq(events.id, eventId));

    if (!event) return;

    // Create notifications for each user
    const notificationData = userIds.map(userId => ({
      userId,
      title: "🚀 Flare Gun Alert!",
      message: `New event "${event.name}" needs players! Location: ${event.location}. Time: ${event.startDate} ${event.startTime}`,
      type: "flare_gun",
      relatedId: eventId,
    }));

    await db.insert(notifications).values(notificationData);
  }

  async respondToFlare(eventId: string, userId: string, status: "interested" | "not_interested" | "maybe"): Promise<FlareResponse> {
    const [response] = await db
      .insert(flareResponses)
      .values({
        eventId,
        userId,
        status,
      })
      .onConflictDoUpdate({
        target: [flareResponses.eventId, flareResponses.userId],
        set: {
          status,
          respondedAt: new Date(),
        },
      })
      .returning();

    return response;
  }

  async getFlareResponses(eventId: string): Promise<(FlareResponse & { user: User })[]> {
    const responses = await db
      .select({
        id: flareResponses.id,
        eventId: flareResponses.eventId,
        userId: flareResponses.userId,
        status: flareResponses.status,
        respondedAt: flareResponses.respondedAt,
        user: users,
      })
      .from(flareResponses)
      .innerJoin(users, eq(flareResponses.userId, users.id))
      .where(eq(flareResponses.eventId, eventId))
      .orderBy(desc(flareResponses.respondedAt));

    return responses;
  }
}

export const storage = new DatabaseStorage();
