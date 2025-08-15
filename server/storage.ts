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
  teamInvitations,
  type User,
  type UpsertUser,
  type AuthUser,
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
  type TeamInvitation,
  type InsertTeamInvitation,
  type ProfileCompletion,
  type UpdateProfile,
  flareResponses,
  type FlareResponse,
  type InsertFlareResponse,
  userEvents,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, or, notInArray, asc, inArray, ne } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  searchUsers(query: string, excludeUserIds?: string[]): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  upsertAuthUser(user: AuthUser): Promise<User>;
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
  updateTeamImage(teamId: string, userId: string, imagePath: string): Promise<void>;
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

  // Recurring event operations
  createRecurringEvents(parentEvent: InsertEvent, numberOfWeeks?: number): Promise<Event[]>;
  getRecurringEventsSeries(recurringSeriesId: string): Promise<Event[]>;
  suspendRecurringSeries(recurringSeriesId: string, userId: string): Promise<void>;
  resumeRecurringSeries(recurringSeriesId: string, userId: string): Promise<void>;
  deleteRecurringEvent(eventId: string, deleteSeriesAfter?: boolean): Promise<void>;

  // Event attendance operations
  recordAttendance(attendance: InsertEventAttendance): Promise<EventAttendance>;
  getEventAttendance(eventId: string): Promise<(EventAttendance & { user: User })[]>;
  getUserAttendance(userId: string, eventId: string): Promise<EventAttendance | undefined>;
  
  // Reserve player management
  promoteReservePlayer(eventId: string, userId: string, promotedById: string): Promise<EventAttendance>;
  demotePlayerToReserve(eventId: string, userId: string, demotedById: string): Promise<EventAttendance>;
  getReservePlayers(eventId: string): Promise<(EventAttendance & { user: User })[]>;
  getEventCapacityInfo(eventId: string): Promise<{
    maxParticipants: number | null;
    reserveSpots: number;
    attendingCount: number;
    reserveCount: number;
    availableSpots: number;
    availableReserveSpots: number;
  }>;

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
  leaveTeam(teamId: string, userId: string): Promise<void>;
  
  // Team invitations
  createTeamInvitation(teamId: string, userId: string, invitedById: string): Promise<TeamInvitation>;
  getTeamInvitations(teamId: string): Promise<(TeamInvitation & { user: User; invitedBy: User; team: Team })[]>;
  getUserInvitations(userId: string): Promise<(TeamInvitation & { team: Team; invitedBy: User })[]>;
  acceptTeamInvitation(invitationId: string, userId: string): Promise<TeamMembership>;
  declineTeamInvitation(invitationId: string, userId: string): Promise<void>;
  getTeamInvitation(invitationId: string): Promise<TeamInvitation | undefined>;
  
  // Join request management
  approveJoinRequest(teamId: string, userId: string, approverId: string): Promise<TeamMembership>;
  rejectJoinRequest(teamId: string, userId: string, rejectedById: string): Promise<void>;
  getTeamAdmins(teamId: string): Promise<User[]>;

  // Activity log operations
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  getEventActivityLogs(eventId: string): Promise<(ActivityLog & { user: User })[]>;

  // User events operations
  addUserEvent(userId: string, eventId: string): Promise<void>;
  removeUserEvent(userId: string, eventId: string): Promise<void>;
  isUserFollowingEvent(userId: string, eventId: string): Promise<boolean>;

  // Flare gun operations
  findNearbyUsers(eventId: string, sport: string, maxResults?: number): Promise<User[]>;
  sendFlareNotifications(eventId: string, userIds: string[]): Promise<void>;
  respondToFlare(eventId: string, userId: string, status: string): Promise<FlareResponse>;
  getFlareResponses(eventId: string): Promise<(FlareResponse & { user: User })[]>;
  activateFlareStatus(eventId: string, userId: string): Promise<void>;
  deactivateFlareStatus(eventId: string): Promise<void>;
  searchFlareEvents(postcode: string, radius: number, sport?: string): Promise<Event[]>;
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

  async searchUsers(query: string, excludeUserIds: string[] = []): Promise<User[]> {
    const searchQuery = `%${query.toLowerCase()}%`;
    
    let whereCondition = or(
      sql`LOWER(${users.username}) LIKE ${searchQuery}`,
      sql`LOWER(${users.email}) LIKE ${searchQuery}`,
      sql`LOWER(${users.phoneNumber}) LIKE ${searchQuery}`,
      sql`LOWER(${users.firstName}) LIKE ${searchQuery}`,
      sql`LOWER(${users.lastName}) LIKE ${searchQuery}`
    );

    // Exclude specified user IDs if provided
    if (excludeUserIds.length > 0) {
      whereCondition = and(
        whereCondition,
        sql`${users.id} NOT IN (${sql.join(excludeUserIds.map(id => sql`${id}`), sql`, `)})`
      );
    }

    const results = await db
      .select()
      .from(users)
      .where(whereCondition)
      .limit(20); // Limit results to avoid too many matches

    return results;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values([{
        id: randomUUID(),
        ...userData,
        authProvider: userData.authProvider || "replit"
      }])
      .onConflictDoUpdate({
        target: users.email,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async upsertAuthUser(userData: AuthUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values([userData])
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          // Only update firstName if it has a value from auth provider
          ...(userData.firstName && { firstName: userData.firstName }),
          // Only update lastName if it has a value from auth provider
          ...(userData.lastName && { lastName: userData.lastName }),
          profileImageUrl: userData.profileImageUrl,
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

  async getUserTeams(userId: string): Promise<(Team & { role: string; memberCount: number; isOwner: boolean })[]> {
    // First get the teams the user belongs to with their roles
    const userTeamsQuery = await db
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
        teamImagePath: teams.teamImagePath,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        role: teamMemberships.role,
        isOwner: sql<boolean>`CASE WHEN ${teams.ownerId} = ${userId} THEN true ELSE false END`,
      })
      .from(teams)
      .innerJoin(teamMemberships, eq(teams.id, teamMemberships.teamId))
      .where(eq(teamMemberships.userId, userId));

    // Then get the member count for each team separately
    const result = [];
    for (const team of userTeamsQuery) {
      const memberCountQuery = await db
        .select({ count: count(teamMemberships.id) })
        .from(teamMemberships)
        .where(eq(teamMemberships.teamId, team.id));
      
      result.push({
        ...team,
        memberCount: memberCountQuery[0]?.count || 0,
      });
    }

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

  async getTeamMembers(teamId: string): Promise<(TeamMembership & { user: User; team: { ownerId: string } })[]> {
    const result = await db
      .select({
        id: teamMemberships.id,
        teamId: teamMemberships.teamId,
        userId: teamMemberships.userId,
        role: teamMemberships.role,
        joinedAt: teamMemberships.joinedAt,
        user: users,
        team: {
          ownerId: teams.ownerId,
        },
      })
      .from(teamMemberships)
      .innerJoin(users, eq(teamMemberships.userId, users.id))
      .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
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

  async updateTeamImage(teamId: string, userId: string, imagePath: string): Promise<void> {
    // Check if user is team owner 
    const team = await this.getTeam(teamId);
    if (!team || team.ownerId !== userId) {
      throw new Error("Only team owners can update team images");
    }

    console.log("Updating team", teamId, "with image path:", imagePath);
    
    await db
      .update(teams)
      .set({ teamImagePath: imagePath, updatedAt: new Date() })
      .where(eq(teams.id, teamId));
      
    console.log("Team image updated successfully");
  }

  async deleteTeam(id: string): Promise<void> {
    // Get all events where this team is the primary team
    const primaryEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.primaryTeamId, id));

    // Delete all events where this team is the primary team
    // This will cascade delete: attendance, notifications, activity logs, payments
    for (const event of primaryEvents) {
      await this.deleteEvent(event.id);
    }

    // Update events that have this team in secondaryTeamIds array
    const eventsWithSecondary = await db
      .select({ id: events.id, secondaryTeamIds: events.secondaryTeamIds })
      .from(events)
      .where(sql`${id} = ANY(${events.secondaryTeamIds})`);

    for (const event of eventsWithSecondary) {
      const updatedSecondaryIds = event.secondaryTeamIds?.filter(teamId => teamId !== id) || [];
      await db
        .update(events)
        .set({ secondaryTeamIds: updatedSecondaryIds })
        .where(eq(events.id, event.id));
    }

    // Delete team-related notifications
    await db
      .delete(notifications)
      .where(eq(notifications.relatedId, id));

    // Delete blocked members (cascade should handle this, but being explicit)
    await db.delete(blockedMembers).where(eq(blockedMembers.teamId, id));
    
    // Delete team memberships (cascade should handle this, but being explicit)
    await db.delete(teamMemberships).where(eq(teamMemberships.teamId, id));
    
    // Delete all event teams relationships
    await db.delete(eventTeams).where(eq(eventTeams.teamId, id));
    
    // Delete any payments associated with this team
    await db.delete(payments).where(eq(payments.teamId, id));
    
    // Finally delete the team itself
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

    // Get events that user has individually followed
    const followedEvents = await db
      .select({ 
        event: events,
        primaryTeam: teams,
        userAttendance: eventAttendance
      })
      .from(userEvents)
      .innerJoin(events, eq(userEvents.eventId, events.id))
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .leftJoin(eventAttendance, and(
        eq(eventAttendance.eventId, events.id),
        eq(eventAttendance.userId, userId)
      ))
      .where(eq(userEvents.userId, userId));

    // Combine and deduplicate events
    const allEvents = [...primaryTeamEvents, ...secondaryTeamEvents, ...followedEvents];
    const uniqueEvents = allEvents.filter((eventData, index, self) => 
      index === self.findIndex(e => e.event.id === eventData.event.id)
    );

    // Sort by start date ascending (next event first)
    uniqueEvents.sort((a, b) => new Date(a.event.startDate).getTime() - new Date(b.event.startDate).getTime());

    // Return events with primary team data and user attendance
    return uniqueEvents.map(result => ({
      ...result.event,
      primaryTeam: result.primaryTeam,
      userAttendance: result.userAttendance
    }));
  }

  async getTeamEvents(teamId: string): Promise<any[]> {
    // Get events where the team is the primary team
    const primaryTeamEvents = await db
      .select({ 
        event: events,
        primaryTeam: teams
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .where(eq(events.primaryTeamId, teamId))
      .orderBy(desc(events.startDate));

    // Get events where the team is a secondary team
    const secondaryTeamEvents = await db
      .select({ 
        event: events,
        primaryTeam: teams
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .innerJoin(eventTeams, eq(events.id, eventTeams.eventId))
      .where(eq(eventTeams.teamId, teamId))
      .orderBy(desc(events.startDate));

    // Combine and deduplicate events
    const allEvents = [...primaryTeamEvents, ...secondaryTeamEvents];
    const uniqueEvents = Array.from(
      new Map(allEvents.map(result => [result.event.id, result])).values()
    );

    return uniqueEvents.map(result => ({
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
    // Use recordAttendance which handles capacity checking and reserve logic
    const result = await this.recordAttendance({
      eventId,
      userId,
      status
    });

    // Automatically add event to user's followed events when they vote to attend
    if (status === "attending") {
      await this.addUserEvent(userId, eventId);
    }

    return result;
  }

  async removeVote(eventId: string, userId: string): Promise<void> {
    // Get the user's current attendance status before removing
    const existingAttendance = await this.getUserAttendance(userId, eventId);
    const wasAttending = existingAttendance?.status === "attending";

    // Get event details to check if it's within 48 hours
    const event = await this.getEvent(eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Check if the event is within 48 hours
    const eventStartDateTime = new Date(`${event.startDate}T${event.startTime}`);
    const now = new Date();
    const hoursUntilEvent = (eventStartDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isWithin48Hours = hoursUntilEvent <= 48 && hoursUntilEvent > 0;

    // Remove the vote directly - if it doesn't exist, this will just do nothing
    await db
      .delete(eventAttendance)
      .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, userId)));

    // Log the unvote activity asynchronously
    this.logActivity({
      eventId,
      userId,
      action: "unvoted",
      previousStatus: existingAttendance?.status || null,
      newStatus: null
    }).catch(err => 
      console.error("Failed to log unvote activity:", err)
    );

    // If the user was attending, automatically promote the first reserve player
    if (wasAttending) {
      this.autoPromoteFromReserve(eventId).catch(err => 
        console.error("Failed to auto-promote from reserve:", err)
      );
    }

    // If unvoting within 48 hours of the event, notify all attendees
    if (wasAttending && isWithin48Hours) {
      this.sendUnvoteNotifications(eventId, userId).catch(err =>
        console.error("Failed to send unvote notifications:", err)
      );
    }
  }

  // Helper method to send unvote notifications to all attendees
  async sendUnvoteNotifications(eventId: string, unvotedUserId: string): Promise<void> {
    try {
      // Get the user who unvoted and the event details
      const [unvotedUser, event] = await Promise.all([
        this.getUser(unvotedUserId),
        this.getEvent(eventId)
      ]);

      if (!unvotedUser || !event) {
        console.error("Failed to get user or event for unvote notification");
        return;
      }

      // Get all attendees who are still attending (excluding the user who unvoted)
      const attendees = await this.getEventAttendance(eventId);
      const attendingUsers = attendees.filter(
        attendee => attendee.status === "attending" && attendee.userId !== unvotedUserId
      );

      if (attendingUsers.length === 0) {
        return; // No one to notify
      }

      // Format the event date nicely
      const eventDate = new Date(`${event.startDate}T${event.startTime}`);
      const formattedDate = eventDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const userName = unvotedUser.firstName && unvotedUser.lastName 
        ? `${unvotedUser.firstName} ${unvotedUser.lastName}`
        : unvotedUser.username || 'A player';

      const notificationTitle = "Player Unavailable - Need Replacement";
      const notificationMessage = `${userName} has unvoted for the event on ${formattedDate}. Can you field another player? Reach out to the organiser.`;

      // Create notifications for all attending users
      const notificationPromises = attendingUsers.map(attendee => 
        this.createNotification({
          userId: attendee.userId,
          title: notificationTitle,
          message: notificationMessage,
          type: "event",
          relatedId: eventId,
          metadata: JSON.stringify({
            unvotedUserId,
            eventName: event.name,
            eventDate: event.startDate,
            eventTime: event.startTime
          })
        })
      );

      await Promise.all(notificationPromises);

      console.log(`Sent unvote notifications to ${attendingUsers.length} attendees for event ${eventId}`);
    } catch (error) {
      console.error("Error sending unvote notifications:", error);
      throw error;
    }
  }

  // Helper method to automatically promote the first reserve player when a spot opens
  async autoPromoteFromReserve(eventId: string): Promise<void> {
    // Get the first reserve player (ordered by when they became a reserve)
    const reserves = await this.getReservePlayers(eventId);
    
    if (reserves.length === 0) {
      return; // No reserve players to promote
    }

    const firstReserve = reserves[0];
    
    // Promote the first reserve player automatically 
    try {
      // Update status to attending directly (bypass admin checks for auto-promotion)
      const [updatedAttendance] = await db
        .update(eventAttendance)
        .set({ 
          status: "attending",
          votedAt: new Date()
        })
        .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, firstReserve.userId)))
        .returning();

      // Log the automatic promotion activity
      await this.logActivity({
        eventId,
        userId: firstReserve.userId,
        action: "auto_promoted_from_reserve",
        previousStatus: "reserve",
        newStatus: "attending",
      });

      // Get event details for notification
      const event = await this.getEvent(eventId);
      
      // Create notification for the auto-promoted user
      if (event) {
        await this.createNotification({
          userId: firstReserve.userId,
          type: "event_update",
          title: "Automatically Promoted!",
          message: `A spot opened up! You've been automatically promoted from the reserve list to the main event for "${event.name}".`,
          relatedId: eventId,

        });
      }
    } catch (error) {
      console.error("Error in auto-promotion:", error);
    }
  }




  async recordAttendance(attendance: InsertEventAttendance): Promise<EventAttendance> {
    // Get event capacity information
    const capacityInfo = await this.getEventCapacityInfo(attendance.eventId);
    
    let finalStatus = attendance.status;
    
    // If user is voting to attend but event is at capacity, place them in reserve
    if (attendance.status === "attending") {
      if (capacityInfo.maxParticipants && capacityInfo.attendingCount >= capacityInfo.maxParticipants) {
        // Event is full, check if reserve spots are available
        if (capacityInfo.availableReserveSpots > 0) {
          finalStatus = "reserve";
        } else {
          throw new Error("Event is full and no reserve spots available");
        }
      }
    }

    const [newAttendance] = await db
      .insert(eventAttendance)
      .values({
        ...attendance,
        status: finalStatus,
        votedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [eventAttendance.eventId, eventAttendance.userId],
        set: {
          status: finalStatus,
          votedAt: new Date(),
        },
      })
      .returning();

    // Log the attendance change
    await this.logActivity({
      eventId: attendance.eventId,
      userId: attendance.userId,
      action: finalStatus === "reserve" ? "placed_in_reserve" : `voted_${finalStatus}`,
      newStatus: finalStatus,
    });

    // Automatically add event to user's followed events when they vote to attend or become a reserve
    if (finalStatus === "attending" || finalStatus === "reserve") {
      await this.addUserEvent(attendance.userId, attendance.eventId);
    }

    // If user changed from attending to not_attending, auto-promote first reserve player
    if (attendance.status === "not_attending") {
      const existingAttendance = await this.getUserAttendance(attendance.userId, attendance.eventId);
      if (existingAttendance?.status === "attending") {
        this.autoPromoteFromReserve(attendance.eventId).catch(err => 
          console.error("Failed to auto-promote from reserve:", err)
        );
      }
    }

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
    totalTeams: number;
    totalPlayers: number;
    unreadNotifications: number;
  }> {
    // Get upcoming events for user's teams (check both primary team and event_teams associations)
    const upcomingEventsFromPrimary = await db
      .select({ count: count() })
      .from(events)
      .innerJoin(teamMemberships, eq(events.primaryTeamId, teamMemberships.teamId))
      .where(
        and(
          eq(teamMemberships.userId, userId),
          eq(events.isPublished, true),
          sql`${events.startDate} >= CURRENT_DATE`
        )
      );

    const upcomingEventsFromJunction = await db
      .select({ count: count() })
      .from(events)
      .innerJoin(eventTeams, eq(events.id, eventTeams.eventId))
      .innerJoin(teamMemberships, eq(eventTeams.teamId, teamMemberships.teamId))
      .where(
        and(
          eq(teamMemberships.userId, userId),
          eq(events.isPublished, true),
          sql`${events.startDate} >= CURRENT_DATE`
        )
      );

    const totalUpcomingEvents = (upcomingEventsFromPrimary[0]?.count || 0) + (upcomingEventsFromJunction[0]?.count || 0);

    // Get active teams count (user's teams)
    const activeTeams = await db
      .select({ count: count() })
      .from(teamMemberships)
      .where(eq(teamMemberships.userId, userId));

    // Get total teams count (platform-wide)
    const totalTeams = await db
      .select({ count: count() })
      .from(teams);

    // Get total players (all users in the platform)
    const totalPlayers = await db
      .select({ count: count() })
      .from(users);

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
      upcomingEvents: totalUpcomingEvents,
      activeTeams: activeTeams[0]?.count || 0,
      totalTeams: totalTeams[0]?.count || 0,
      totalPlayers: totalPlayers[0]?.count || 0,
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
        authProvider: null, // Not selected in query
        username: member.username,
        phoneNumber: member.phoneNumber,
        dateOfBirth: null, // Not selected in query
        postcode: null, // Not selected in query
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
        teamImagePath: teams.teamImagePath,
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

    // Filter out teams that have blocked the user and check membership
    const resultsWithMembership = [];
    for (const team of searchResults) {
      // Check if user is blocked by this team
      const isBlocked = await this.isUserBlocked(team.id, userId);
      if (!isBlocked) {
        const membership = await this.getUserTeam(userId, team.id);
        resultsWithMembership.push({
          ...team,
          isMember: !!membership,
        });
      }
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
        message: `${user.firstName || user.username || 'User'} ${user.lastName || ''} wants to join ${team.name}`.trim(),
        relatedId: teamId,
        metadata: JSON.stringify({
          teamId: teamId,
          requestUserId: userId
        }),
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
          authProvider: sql<"replit" | "google" | "apple">`blocker.auth_provider`,
          username: sql<string>`blocker.username`,
          phoneNumber: sql<string>`blocker.phone_number`,
          dateOfBirth: sql<string>`blocker.date_of_birth`,
          postcode: sql<string>`blocker.postcode`,
          gender: sql<"male" | "female">`blocker.gender`,
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

    // Prevent self-approval
    if (userId === approverId) {
      throw new Error("Cannot approve your own join request");
    }

    // Check if user is already a member
    const existingMembership = await this.getUserTeam(userId, teamId);
    if (existingMembership) {
      throw new Error("User is already a member of this team");
    }

    // Add user to team
    const membership = await this.addTeamMember(teamId, userId, "member");

    // Mark the specific join request notification as read
    await db
      .update(notifications)
      .set({ 
        isRead: true,
        readAt: new Date() 
      })
      .where(and(
        eq(notifications.type, "team_join_request"),
        eq(notifications.relatedId, teamId),
        eq(notifications.userId, approverId),
        sql`JSON_EXTRACT(metadata, '$.requestUserId') = ${userId}`
      ));

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

    // Mark the specific join request notification as read
    await db
      .update(notifications)
      .set({ 
        isRead: true,
        readAt: new Date() 
      })
      .where(and(
        eq(notifications.type, "team_join_request"),
        eq(notifications.relatedId, teamId),
        eq(notifications.userId, rejectedById),
        sql`JSON_EXTRACT(metadata, '$.requestUserId') = ${userId}`
      ));

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

  // Leave team functionality
  async leaveTeam(teamId: string, userId: string): Promise<void> {
    const team = await this.getTeam(teamId);
    if (!team) {
      throw new Error("Team not found");
    }

    // Check if user is the team owner
    if (team.ownerId === userId) {
      throw new Error("Team owners cannot leave their team. Please transfer ownership or delete the team instead.");
    }

    // Check if user is a member
    const membership = await this.getUserTeam(userId, teamId);
    if (!membership) {
      throw new Error("User is not a member of this team");
    }

    // Remove from team
    await this.removeTeamMember(teamId, userId);

    // Log the activity (skip activity logging for team leave as it doesn't relate to a specific event)
    // await this.logActivity({
    //   userId,
    //   action: "left_team", 
    //   details: `Left team ${team.name}`,
    //   ipAddress: "system",
    //   teamId
    // });
  }

  // Team invitation methods
  async createTeamInvitation(teamId: string, userId: string, invitedById: string): Promise<TeamInvitation> {
    // Check if user is already a member
    const existingMembership = await this.getUserTeam(userId, teamId);
    if (existingMembership) {
      throw new Error("User is already a team member");
    }

    // Check if user is blocked
    const isBlocked = await this.isUserBlocked(teamId, userId);
    if (isBlocked) {
      throw new Error("Cannot invite blocked user");
    }

    // Check if there's a pending invitation (don't allow duplicate pending invitations)
    const existingInvitation = await db
      .select()
      .from(teamInvitations)
      .where(and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.userId, userId),
        eq(teamInvitations.status, "pending")
      ))
      .limit(1);

    if (existingInvitation.length > 0) {
      throw new Error("User already has a pending invitation to this team");
    }

    // Check if there are any previous invitations (accepted/declined) and delete them to allow resending
    await db
      .delete(teamInvitations)
      .where(and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.userId, userId),
        ne(teamInvitations.status, "pending")
      ));

    // Create invitation
    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        teamId,
        userId,
        invitedById,
        status: "pending"
      })
      .returning();

    // Create notification for the invited user
    const team = await this.getTeam(teamId);
    const inviter = await this.getUser(invitedById);
    
    if (team && inviter) {
      await this.createNotification({
        userId,
        title: "Team Invitation",
        message: `${inviter.username || inviter.firstName} invited you to join "${team.name}"`,
        type: "team_invitation",
        relatedId: invitation.id
      });
    }

    return invitation;
  }

  async getTeamInvitations(teamId: string): Promise<(TeamInvitation & { user: User; invitedBy: User; team: Team })[]> {
    const result = await db
      .select({
        id: teamInvitations.id,
        teamId: teamInvitations.teamId,
        userId: teamInvitations.userId,
        invitedById: teamInvitations.invitedById,
        status: teamInvitations.status,
        invitedAt: teamInvitations.invitedAt,
        respondedAt: teamInvitations.respondedAt,
        user: users,
        invitedBy: {
          id: sql<string>`inviter.id`,
          username: sql<string>`inviter.username`,
          firstName: sql<string>`inviter.first_name`,
          lastName: sql<string>`inviter.last_name`,
          email: sql<string>`inviter.email`,
          profileImageUrl: sql<string>`inviter.profile_image_url`,
        },
        team: teams,
      })
      .from(teamInvitations)
      .innerJoin(users, eq(teamInvitations.userId, users.id))
      .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
      .innerJoin(sql`users AS inviter`, eq(teamInvitations.invitedById, sql`inviter.id`))
      .where(eq(teamInvitations.teamId, teamId))
      .orderBy(desc(teamInvitations.invitedAt));

    return result as any;
  }

  async getUserInvitations(userId: string): Promise<(TeamInvitation & { team: Team; invitedBy: User })[]> {
    const result = await db
      .select({
        id: teamInvitations.id,
        teamId: teamInvitations.teamId,
        userId: teamInvitations.userId,
        invitedById: teamInvitations.invitedById,
        status: teamInvitations.status,
        invitedAt: teamInvitations.invitedAt,
        respondedAt: teamInvitations.respondedAt,
        team: {
          id: teams.id,
          name: teams.name,
          description: teams.description,
          ownerId: teams.ownerId,
          gender: teams.gender,

          createdAt: teams.createdAt,
          updatedAt: teams.updatedAt,
        },
        invitedBy: {
          id: sql<string>`inviter.id`,
          username: sql<string>`inviter.username`,
          firstName: sql<string>`inviter.first_name`,
          lastName: sql<string>`inviter.last_name`,
          email: sql<string>`inviter.email`,
          profileImageUrl: sql<string>`inviter.profile_image_url`,
        },
      })
      .from(teamInvitations)
      .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
      .innerJoin(sql`users AS inviter`, eq(teamInvitations.invitedById, sql`inviter.id`))
      .where(and(
        eq(teamInvitations.userId, userId),
        eq(teamInvitations.status, "pending")
      ))
      .orderBy(desc(teamInvitations.invitedAt));

    return result as any;
  }

  async acceptTeamInvitation(invitationId: string, userId: string): Promise<TeamMembership> {
    // Get the invitation
    const invitation = await this.getTeamInvitation(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.userId !== userId) {
      throw new Error("Not authorized to accept this invitation");
    }

    if (invitation.status !== "pending") {
      throw new Error("Invitation is no longer pending");
    }

    // Check if user is still available (not blocked, not already a member)
    const existingMembership = await this.getUserTeam(userId, invitation.teamId);
    if (existingMembership) {
      throw new Error("User is already a team member");
    }

    const isBlocked = await this.isUserBlocked(invitation.teamId, userId);
    if (isBlocked) {
      throw new Error("Cannot join team - user is blocked");
    }

    // Add user to team
    const membership = await this.addTeamMember(invitation.teamId, userId, "member");

    // Update invitation status
    await db
      .update(teamInvitations)
      .set({
        status: "accepted",
        respondedAt: new Date()
      })
      .where(eq(teamInvitations.id, invitationId));

    // Mark the original invitation notification as read
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.relatedId, invitationId),
        eq(notifications.type, "team_invitation")
      ));

    // Notify the inviter
    const team = await this.getTeam(invitation.teamId);
    const user = await this.getUser(userId);
    
    if (team && user) {
      await this.createNotification({
        userId: invitation.invitedById,
        title: "Invitation Accepted",
        message: `${user.username || user.firstName} accepted your invitation to join "${team.name}"`,
        type: "team_invitation_accepted",
        relatedId: invitation.teamId
      });
    }

    return membership;
  }

  async declineTeamInvitation(invitationId: string, userId: string): Promise<void> {
    // Get the invitation
    const invitation = await this.getTeamInvitation(invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.userId !== userId) {
      throw new Error("Not authorized to decline this invitation");
    }

    if (invitation.status !== "pending") {
      throw new Error("Invitation is no longer pending");
    }

    // Update invitation status
    await db
      .update(teamInvitations)
      .set({
        status: "declined",
        respondedAt: new Date()
      })
      .where(eq(teamInvitations.id, invitationId));

    // Mark the original invitation notification as read
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.relatedId, invitationId),
        eq(notifications.type, "team_invitation")
      ));

    // Notify the inviter
    const team = await this.getTeam(invitation.teamId);
    const user = await this.getUser(userId);
    
    if (team && user) {
      await this.createNotification({
        userId: invitation.invitedById,
        title: "Invitation Declined",
        message: `${user.username || user.firstName} declined your invitation to join "${team.name}"`,
        type: "team_invitation_declined",
        relatedId: invitation.teamId
      });
    }
  }

  async getTeamInvitation(invitationId: string): Promise<TeamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, invitationId))
      .limit(1);

    return invitation;
  }

  // Flare gun operations
  async findNearbyUsers(eventId: string, sport: string, maxResults: number = 20): Promise<User[]> {
    // Get the event details to find the location/postcode and associated teams
    const [event] = await db
      .select({ 
        location: events.location, 
        primaryTeamId: events.primaryTeamId,
        secondaryTeamIds: events.secondaryTeamIds
      })
      .from(events)
      .where(eq(events.id, eventId));

    if (!event) return [];

    // Get all team IDs associated with this event
    const associatedTeamIds = [event.primaryTeamId];
    if (event.secondaryTeamIds && Array.isArray(event.secondaryTeamIds)) {
      associatedTeamIds.push(...event.secondaryTeamIds);
    }

    // Format array for PostgreSQL
    const teamIdsArray = `{${associatedTeamIds.join(',')}}`;

    // Find users who:
    // 1. Have this sport in their interests
    // 2. Are NOT members of teams associated with this specific event
    // 3. Have flare gun notifications enabled
    // 4. Have completed their profile
    const nearbyUsers = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
        sportsInterests: users.sportsInterests,
        postcode: users.postcode,
        profileCompletedAt: users.profileCompletedAt,
      })
      .from(users)
      .leftJoin(notificationPreferences, eq(users.id, notificationPreferences.userId))
      .where(
        and(
          sql`${sport} = ANY(${users.sportsInterests})`,
          // Exclude users who are members of teams associated with this event
          sql`${users.id} NOT IN (
            SELECT user_id FROM team_memberships 
            WHERE team_id = ANY(${teamIdsArray}::text[])
          )`,
          // Only include users who have completed their profile
          sql`${users.profileCompletedAt} IS NOT NULL`,
          // Only include users who have flare gun notifications enabled (default to true if no preferences set)
          or(
            eq(notificationPreferences.flareGunReminders, true),
            sql`${notificationPreferences.userId} IS NULL`
          )
        )
      )
      .limit(maxResults);

    // Return with all required User fields
    return nearbyUsers.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      authProvider: null, // Not selected in this query
      username: user.username,
      phoneNumber: null, // Not selected in this query
      dateOfBirth: null, // Not selected in this query
      postcode: user.postcode,
      gender: null, // Not selected in this query
      sportsInterests: user.sportsInterests || [],
      travelRadius: null, // Not selected in this query
      stripeCustomerId: null, // Not selected in this query
      stripeSubscriptionId: null, // Not selected in this query
      profileCompletedAt: user.profileCompletedAt,
      createdAt: null, // Not selected in this query
      updatedAt: null, // Not selected in this query
    }));
  }

  async sendFlareNotifications(eventId: string, userIds: string[]): Promise<void> {
    // Get event details for notification
    const [eventResult] = await db
      .select({ 
        event: events,
        team: teams
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .where(eq(events.id, eventId));

    if (!eventResult) return;

    const { event, team } = eventResult;

    // Filter out blocked users from receiving notifications
    const eligibleUserIds: string[] = [];
    for (const userId of userIds) {
      const isBlocked = await this.isUserBlocked(team.id, userId);
      if (!isBlocked) {
        eligibleUserIds.push(userId);
      }
    }

    // If no eligible users after filtering, exit early
    if (eligibleUserIds.length === 0) {
      console.log(`No eligible users for flare notifications (all ${userIds.length} users are blocked from team ${team.id})`);
      return;
    }

    // Create notifications for each eligible user with event metadata
    const eventData = {
      id: event.id,
      title: event.name,
      startDate: event.startDate,
      startTime: event.startTime,
      location: event.location,
      description: (event as any).description || null,
      sport: event.sport,
      primaryTeamName: team.name
    };

    const notificationData = eligibleUserIds.map(userId => ({
      userId,
      title: "🚀 Flare Gun Alert!",
      message: `${team.name} needs players for "${event.name}"! Check out the event details and join if interested.`,
      type: "flare_gun",
      relatedId: eventId,
      metadata: JSON.stringify({ eventData })
    }));

    await db.insert(notifications).values(notificationData);

    console.log(`Sent flare notifications to ${eligibleUserIds.length}/${userIds.length} users (${userIds.length - eligibleUserIds.length} blocked users excluded)`);
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

  async activateFlareStatus(eventId: string, userId: string): Promise<void> {
    await db
      .update(events)
      .set({
        flareStatus: "active",
        flareActivatedAt: new Date(),
        flareActivatedById: userId,
      })
      .where(eq(events.id, eventId));
  }

  async deactivateFlareStatus(eventId: string): Promise<void> {
    await db
      .update(events)
      .set({
        flareStatus: "inactive",
        flareActivatedAt: null,
        flareActivatedById: null,
      })
      .where(eq(events.id, eventId));
  }

  // Search for events that have active flare status (events actively seeking players)
  async searchFlareEvents(postcode: string, radiusMiles: number, sport?: string, userId?: string): Promise<any[]> {
    // Build query to find events with active flare status
    let whereConditions = and(
      sql`${events.startDate} >= CURRENT_DATE`, // Future events only
      eq(events.isPublished, true),
      eq(events.flareStatus, "active") // Only events with active flare status
    );

    // Add sport filter if specified and not "all"
    if (sport && sport !== "all") {
      whereConditions = and(whereConditions, eq(events.sport, sport));
    }

    const flareEvents = await db
      .select({
        id: events.id,
        name: events.name,
        sport: events.sport,
        startDate: events.startDate,
        startTime: events.startTime,
        location: events.location,
        postcode: events.postcode,
        requirements: events.requirements,
        maxParticipants: events.maxParticipants,
        flareStatus: events.flareStatus,
        flareActivatedAt: events.flareActivatedAt,
        team: teams,
      })
      .from(events)
      .innerJoin(teams, eq(events.primaryTeamId, teams.id))
      .where(whereConditions)
      .orderBy(desc(events.flareActivatedAt), events.startDate)
      .limit(50);

    // Filter out events from teams that have blocked the searching user
    let filteredEvents = flareEvents;
    if (userId) {
      const eligibleEvents = [];
      for (const event of flareEvents) {
        const isBlocked = await this.isUserBlocked(event.team.id, userId);
        if (!isBlocked) {
          eligibleEvents.push(event);
        }
      }
      filteredEvents = eligibleEvents;
    }

    // TODO: Add actual distance calculation based on postcode
    // For now, return all events with a mock distance
    return filteredEvents.map(event => ({
      ...event,
      distance: Math.random() * radiusMiles // Mock distance for now
    }));
  }

  // User events management - for events users follow outside of team membership
  async addUserEvent(userId: string, eventId: string): Promise<void> {
    await db
      .insert(userEvents)
      .values({ userId, eventId })
      .onConflictDoNothing();
  }

  async removeUserEvent(userId: string, eventId: string): Promise<void> {
    await db
      .delete(userEvents)
      .where(and(eq(userEvents.userId, userId), eq(userEvents.eventId, eventId)));
  }

  async isUserFollowingEvent(userId: string, eventId: string): Promise<boolean> {
    const [result] = await db
      .select({ id: userEvents.id })
      .from(userEvents)
      .where(and(eq(userEvents.userId, userId), eq(userEvents.eventId, eventId)))
      .limit(1);
    
    return !!result;
  }

  // Reserve player management methods
  async promoteReservePlayer(eventId: string, userId: string, promotedById: string): Promise<EventAttendance> {
    // Check if user is currently in reserve status
    const existingAttendance = await this.getUserAttendance(userId, eventId);
    if (!existingAttendance || existingAttendance.status !== "reserve") {
      throw new Error("User is not currently in reserve status");
    }

    // NOTE: Admins can promote reserves even when at capacity (allowing overflow like 14/10)
    // This is intentional for admin control and flexibility

    // Update status to attending
    const [updatedAttendance] = await db
      .update(eventAttendance)
      .set({ 
        status: "attending",
        votedAt: new Date()
      })
      .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, userId)))
      .returning();

    // Log the promotion activity
    await this.logActivity({
      eventId,
      userId,
      action: "promoted_from_reserve",
      previousStatus: "reserve",
      newStatus: "attending",
    });

    // Ensure event is in user's followed events when promoted
    await this.addUserEvent(userId, eventId);

    // Get event and user details for notification
    const event = await this.getEvent(eventId);
    const user = await this.getUser(userId);
    
    // Create notification for the promoted user
    if (event && user) {
      await this.createNotification({
        userId,
        type: "event_update",
        title: "Promoted to Main Event!",
        message: `You've been promoted from the reserve list to the main event for "${event.name}".`,
        relatedId: eventId,

      });
    }

    return updatedAttendance;
  }

  async demotePlayerToReserve(eventId: string, userId: string, demotedById: string): Promise<EventAttendance> {
    // Check if user is currently attending
    const existingAttendance = await this.getUserAttendance(userId, eventId);
    if (!existingAttendance || existingAttendance.status !== "attending") {
      throw new Error("User is not currently attending");
    }

    // Check reserve capacity
    const capacityInfo = await this.getEventCapacityInfo(eventId);
    if (capacityInfo.reserveCount >= capacityInfo.reserveSpots) {
      throw new Error("Reserve spots are full");
    }

    // Update status to reserve
    const [updatedAttendance] = await db
      .update(eventAttendance)
      .set({ 
        status: "reserve",
        votedAt: new Date()
      })
      .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, userId)))
      .returning();

    // Log the demotion activity
    await this.logActivity({
      eventId,
      userId,
      action: "demoted_to_reserve",
      previousStatus: "attending",
      newStatus: "reserve",
    });

    return updatedAttendance;
  }

  async getReservePlayers(eventId: string): Promise<(EventAttendance & { user: User })[]> {
    const reserves = await db
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
      .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.status, "reserve")))
      .orderBy(eventAttendance.votedAt); // Order by voted date - first to reserve gets promoted first

    return reserves;
  }

  async getEventCapacityInfo(eventId: string): Promise<{
    maxParticipants: number | null;
    reserveSpots: number;
    attendingCount: number;
    reserveCount: number;
    availableSpots: number;
    availableReserveSpots: number;
  }> {
    // Get event details
    const [event] = await db
      .select({ participants: events.maxParticipants, reserveSpots: events.reserveSpots })
      .from(events)
      .where(eq(events.id, eventId));

    if (!event) {
      throw new Error("Event not found");
    }

    // Count attending and reserve players
    const attendanceCounts = await db
      .select({
        status: eventAttendance.status,
        count: count()
      })
      .from(eventAttendance)
      .where(eq(eventAttendance.eventId, eventId))
      .groupBy(eventAttendance.status);

    const attendingCount = attendanceCounts.find(c => c.status === "attending")?.count || 0;
    const reserveCount = attendanceCounts.find(c => c.status === "reserve")?.count || 0;

    const maxParticipants = event.participants;
    const reserveSpots = event.reserveSpots || 0;
    
    const availableSpots = maxParticipants ? Math.max(0, maxParticipants - attendingCount) : Infinity;
    const availableReserveSpots = Math.max(0, reserveSpots - reserveCount);

    return {
      maxParticipants,
      reserveSpots,
      attendingCount: Number(attendingCount),
      reserveCount: Number(reserveCount),
      availableSpots: availableSpots === Infinity ? -1 : Number(availableSpots),
      availableReserveSpots: Number(availableReserveSpots),
    };
  }

  // Recurring Events Methods
  async createRecurringEvents(parentEvent: InsertEvent, numberOfWeeks: number = 4): Promise<Event[]> {
    if (parentEvent.recurrenceType === "none") {
      // Create single event
      return [await this.createEvent(parentEvent)];
    }

    const recurringSeriesId = randomUUID();
    const createdEvents: Event[] = [];
    
    // Helper function to get next date based on recurrence
    const getNextEventDate = (currentDate: Date, recurrenceType: string, daysOfWeek: string[]): Date => {
      const nextDate = new Date(currentDate);
      
      switch (recurrenceType) {
        case "daily":
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case "weekly":
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case "monthly":
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }
      
      return nextDate;
    };

    // For weekly recurrence, find the first occurrence of the selected day
    let currentDate = new Date(parentEvent.startDate);
    if (parentEvent.recurrenceType === "weekly" && parentEvent.recurrenceDaysOfWeek.length > 0) {
      const targetDayName = parentEvent.recurrenceDaysOfWeek[0]; // Take the first selected day
      const targetDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(targetDayName);
      const currentDay = currentDate.getDay();
      
      // Calculate days until the target day
      let daysUntilTarget = (targetDay - currentDay + 7) % 7;
      if (daysUntilTarget === 0 && currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() !== targetDayName) {
        daysUntilTarget = 7; // If today is not the target day, wait for next week
      }
      
      currentDate.setDate(currentDate.getDate() + daysUntilTarget);
    }
    
    const endGenerationDate = new Date(currentDate);
    endGenerationDate.setDate(endGenerationDate.getDate() + (numberOfWeeks * 7));

    while (currentDate <= endGenerationDate) {
      const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      const shouldCreateEvent = parentEvent.recurrenceType === "daily" || 
        (parentEvent.recurrenceType === "weekly" && 
         parentEvent.recurrenceDaysOfWeek.includes(dayOfWeek)) ||
        parentEvent.recurrenceType === "monthly";

      if (shouldCreateEvent) {
        const eventData: InsertEvent = {
          ...parentEvent,
          startDate: currentDate.toISOString().split('T')[0],
          endDate: parentEvent.endDate ? 
            new Date(new Date(parentEvent.endDate).getTime() + (currentDate.getTime() - new Date(parentEvent.startDate).getTime())).toISOString().split('T')[0] : 
            null,
          recurringSeriesId,
        };

        const createdEvent = await this.createEvent(eventData);
        createdEvents.push(createdEvent);
      }

      currentDate = getNextEventDate(currentDate, parentEvent.recurrenceType, parentEvent.recurrenceDaysOfWeek);
    }

    return createdEvents;
  }

  async getRecurringEventsSeries(recurringSeriesId: string): Promise<Event[]> {
    return db
      .select()
      .from(events)
      .where(eq(events.recurringSeriesId, recurringSeriesId))
      .orderBy(events.startDate);
  }

  async suspendRecurringSeries(recurringSeriesId: string, userId: string): Promise<void> {
    // Update all events in the series to suspended (not just future ones for testing)
    await db
      .update(events)
      .set({ isRecurringSuspended: true })
      .where(eq(events.recurringSeriesId, recurringSeriesId));
  }

  async resumeRecurringSeries(recurringSeriesId: string, userId: string): Promise<void> {
    await db
      .update(events)
      .set({ isRecurringSuspended: false })
      .where(eq(events.recurringSeriesId, recurringSeriesId));
  }

  async publishRecurringSeries(recurringSeriesId: string, userId: string): Promise<void> {
    await db
      .update(events)
      .set({ isPublished: true })
      .where(eq(events.recurringSeriesId, recurringSeriesId));
  }

  async deleteRecurringEvent(eventId: string, deleteSeriesAfter: boolean = false): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) throw new Error("Event not found");

    if (deleteSeriesAfter && event.recurringSeriesId) {
      // Delete this event and all future events in the series
      await db
        .delete(events)
        .where(
          and(
            eq(events.recurringSeriesId, event.recurringSeriesId),
            sql`${events.startDate} >= ${event.startDate}`
          )
        );
    } else {
      // Delete only this single event
      await this.deleteEvent(eventId);
    }
  }
}

export const storage = new DatabaseStorage();
