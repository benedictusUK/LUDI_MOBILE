import { describe, test, expect, beforeEach } from '@jest/globals';
import { DatabaseStorage } from '../server/storage';

describe('End-to-End Integration Tests', () => {
  let storage: DatabaseStorage;
  let testUserId: string;

  beforeEach(async () => {
    storage = new DatabaseStorage();

    // Create test user for integration tests
    const user = await storage.upsertUser({
      email: 'integration@example.com',
      firstName: 'Integration',
      lastName: 'User',
      username: 'integrationuser',
      phoneNumber: '+441234567890',
      dateOfBirth: '1990-01-01',
      postcode: 'SW1A 1AA',
      gender: 'male',
      sportsInterests: ['Football'],
      travelRadius: 15
    });
    testUserId = user.id;
  });

  describe('Complete User Journey', () => {
    test('should complete full user workflow: team creation -> event creation -> voting -> flare', async () => {
      // Step 1: Create a team
      const team = await storage.createTeam({
        name: 'Integration Test Team',
        sports: ['Football'],
        description: 'Team created during integration test',
        gender: 'mixed',
        maxPlayers: 11,
        isPrivate: false,
        requiresApproval: false
      }, testUserId);

      expect(team.name).toBe('Integration Test Team');

      // Step 2: Create an event for the team
      const event = await storage.createEvent({
        name: 'Integration Test Event',
        sport: 'Football',
        startDate: '2025-09-01',
        startTime: '15:00',
        endDate: '2025-09-01',
        endTime: '17:00',
        location: 'Integration Stadium',
        address: '123 Integration Street',
        postcode: 'SW1A 1AA',
        requirements: 'Integration test event',
        gender: 'mixed',
        maxParticipants: 20,
        reserveSpots: 5,
        cost: '10.00',
        primaryTeamId: team.id,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      expect(event.name).toBe('Integration Test Event');

      // Step 3: Vote on the event
      const attendance = await storage.voteOnEvent(event.id, testUserId, 'attending');
      expect(attendance.status).toBe('attending');

      // Step 4: Check attendance
      const attendanceList = await storage.getEventAttendance(event.id);
      expect(attendanceList.length).toBe(1);
      expect(attendanceList[0].status).toBe('attending');

      // Step 5: Send flare notifications
      await storage.sendFlareNotifications(event.id, [testUserId]);

      // Step 6: Respond to flare
      const flareResponse = await storage.respondToFlare(event.id, testUserId, 'interested');
      expect(flareResponse.status).toBe('interested');

      // Step 7: Check flare responses
      const responses = await storage.getFlareResponses(event.id);
      expect(responses.length).toBe(1);
      expect(responses[0].status).toBe('interested');
    });

    test('should handle recurring event creation and management', async () => {
      // Create team first
      const team = await storage.createTeam({
        name: 'Recurring Test Team',
        sports: ['Football'],
        description: 'Team for recurring tests',
        gender: 'mixed',
        maxPlayers: 11,
        isPrivate: false,
        requiresApproval: false
      }, testUserId);

      // Create recurring events
      const events = await storage.createRecurringEvents({
        name: 'Weekly Training Session',
        sport: 'Football',
        startDate: '2025-08-01',
        startTime: '18:00',
        endTime: '20:00',
        location: 'Training Ground',
        address: '456 Training Ave',
        postcode: 'SW1A 1BB',
        requirements: 'Weekly training',
        gender: 'mixed',
        maxParticipants: 15,
        reserveSpots: 3,
        cost: '0.00',
        primaryTeamId: team.id,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'weekly',
        recurrenceEndDate: '2025-12-31',
        recurrenceDaysOfWeek: ['friday'],
        endDate: '2025-08-01',
        isRecurringSuspended: false
      });

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(5);

      const seriesId = events[0].recurringSeriesId;
      expect(seriesId).toBeDefined();

      // Get series events
      const seriesEvents = await storage.getRecurringEventsSeries(seriesId!);
      expect(seriesEvents.length).toBe(events.length);

      // Suspend series
      await storage.suspendRecurringSeries(seriesId!, testUserId);

      // Resume series
      await storage.resumeRecurringSeries(seriesId!, testUserId);
    });

    test('should handle reserve player system end-to-end', async () => {
      // Create team
      const team = await storage.createTeam({
        name: 'Reserve System Test Team',
        sports: ['Football'],
        description: 'Testing reserve system',
        gender: 'mixed',
        maxPlayers: 11,
        isPrivate: false,
        requiresApproval: false
      }, testUserId);

      // Create event with limited capacity
      const event = await storage.createEvent({
        name: 'Reserve Test Match',
        sport: 'Football',
        startDate: '2025-09-15',
        startTime: '14:00',
        endDate: '2025-09-15',
        endTime: '16:00',
        location: 'Small Ground',
        address: '789 Small Street',
        postcode: 'SW1A 1CC',
        requirements: 'Testing reserves',
        gender: 'mixed',
        maxParticipants: 2, // Small capacity for testing
        reserveSpots: 3,
        cost: '8.00',
        primaryTeamId: team.id,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      // Create additional users
      const user2 = await storage.upsertUser({
        email: 'reserve2@example.com',
        firstName: 'Reserve',
        lastName: 'User2',
        username: 'reserveuser2',
        phoneNumber: '+441234567892',
        dateOfBirth: '1991-01-01',
        postcode: 'SW1A 1DD',
        gender: 'female',
        sportsInterests: ['Football'],
        travelRadius: 10
      });

      const user3 = await storage.upsertUser({
        email: 'reserve3@example.com',
        firstName: 'Reserve',
        lastName: 'User3',
        username: 'reserveuser3',
        phoneNumber: '+441234567893',
        dateOfBirth: '1992-01-01',
        postcode: 'SW1A 1EE',
        gender: 'male',
        sportsInterests: ['Football'],
        travelRadius: 20
      });

      // Fill main capacity
      await storage.voteOnEvent(event.id, testUserId, 'attending');

      // This should go to reserves
      await storage.voteOnEvent(event.id, user2.id, 'attending');
      await storage.voteOnEvent(event.id, user3.id, 'attending');

      // Check capacity
      const capacity = await storage.getEventCapacityInfo(event.id);
      expect(capacity.attendingCount).toBe(1);
      expect(capacity.reserveCount).toBe(2);

      // Get reserves
      const reserves = await storage.getReservePlayers(event.id);
      expect(reserves.length).toBe(2);

      // Promote a reserve (admin action)
      await storage.promoteReservePlayer(event.id, user2.id, testUserId);

      // Check capacity after promotion (should show overflow)
      const newCapacity = await storage.getEventCapacityInfo(event.id);
      expect(newCapacity.attendingCount).toBe(2); // 2/2 (at capacity)
      expect(newCapacity.reserveCount).toBe(1); // One remaining
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent resources', async () => {
      const nonExistentId = 'non-existent-id';

      // Try to get non-existent team
      const team = await storage.getTeam(nonExistentId);
      expect(team).toBeUndefined();

      // Try to get non-existent event
      const event = await storage.getEvent(nonExistentId);
      expect(event).toBeUndefined();

      // Try to get non-existent user
      const user = await storage.getUser(nonExistentId);
      expect(user).toBeUndefined();
    });
  });
});