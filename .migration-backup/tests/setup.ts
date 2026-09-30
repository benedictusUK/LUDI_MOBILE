import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { 
  users, teams, events, teamMemberships, eventAttendance, blockedMembers, 
  notifications, notificationPreferences, flareResponses, payments, activityLogs, eventTeams 
} from '../shared/schema';

// Test database cleanup and setup
beforeAll(async () => {
  console.log('Setting up test environment...');
});

beforeEach(async () => {
  // Clean up test data before each test (order matters for foreign key constraints)
  try {
    // Delete in reverse dependency order to avoid foreign key violations
    await db.delete(flareResponses);
    await db.delete(activityLogs);
    await db.delete(eventAttendance);
    await db.delete(eventTeams);
    await db.delete(payments);
    await db.delete(notifications);
    await db.delete(notificationPreferences);
    await db.delete(events);  // Must delete events before teams due to primary_team_id
    await db.delete(blockedMembers);
    await db.delete(teamMemberships);
    await db.delete(teams);   // Must delete teams before users due to owner_id
    await db.delete(users);
  } catch (error) {
    console.warn('Database cleanup warning:', error);
    // If cleanup fails, try to forcefully clear tables
    try {
      await db.execute(sql`TRUNCATE TABLE flare_responses, activity_logs, event_attendance, event_teams, payments, notifications, notification_preferences, events, blocked_members, team_memberships, teams, users RESTART IDENTITY CASCADE`);
    } catch (truncateError) {
      console.error('Truncate fallback failed:', truncateError);
    }
  }
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
});