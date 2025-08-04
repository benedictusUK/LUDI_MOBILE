import { beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../server/db';
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
    await db.delete(flareResponses);
    await db.delete(activityLogs);
    await db.delete(eventAttendance);
    await db.delete(eventTeams);
    await db.delete(payments);
    await db.delete(notifications);
    await db.delete(notificationPreferences);
    await db.delete(blockedMembers);
    await db.delete(teamMemberships);
    await db.delete(events);
    await db.delete(teams);
    await db.delete(users);
  } catch (error) {
    console.warn('Database cleanup warning:', error);
  }
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
});