import { describe, test, expect, beforeEach } from '@jest/globals';
import { DatabaseStorage } from '../server/storage';

describe('Event Management', () => {
  let storage: DatabaseStorage;
  let testUserId: string;
  let testTeamId: string;

  beforeEach(async () => {
    storage = new DatabaseStorage();

    // Create test user
    const user = await storage.upsertUser({
      email: 'eventuser@example.com',
      firstName: 'Event',
      lastName: 'User',
      username: 'eventuser',
      phoneNumber: '+441234567890',
      dateOfBirth: '1990-01-01',
      postcode: 'SW1A 1AA',
      gender: 'male',
      sportsInterests: ['Football'],
      travelRadius: 15
    });
    testUserId = user.id;

    // Create test team
    const team = await storage.createTeam({
      name: 'Event Test Team',
      sports: ['Football'],
      description: 'Team for event testing',
      gender: 'mixed',
      maxPlayers: 11,
      isPrivate: false,
      requiresApproval: false
    }, testUserId);
    testTeamId = team.id;
  });

  describe('Event Creation & Management', () => {
    test('should create event successfully', async () => {
      const eventData = {
        name: 'Test Football Match',
        sport: 'Football',
        startDate: '2025-08-15',
        startTime: '15:00',
        endDate: '2025-08-15',
        endTime: '17:00',
        location: 'Test Stadium',
        address: '123 Test Street, London',
        postcode: 'SW1A 1AA',
        requirements: 'Bring your own boots',
        gender: 'mixed' as const,
        maxParticipants: 22,
        reserveSpots: 4,
        cost: '10.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none' as const,
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      };

      const event = await storage.createEvent(eventData);
      expect(event.name).toBe(eventData.name);
      expect(event.sport).toBe(eventData.sport);
      expect(event.primaryTeamId).toBe(testTeamId);
      expect(event.participants).toBe(22);
      expect(event.reserveSpots).toBe(4);
    });

    test('should handle event voting and attendance', async () => {
      const event = await storage.createEvent({
        name: 'Voting Test Event',
        sport: 'Football',
        startDate: '2025-08-20',
        startTime: '18:00',
        endDate: '2025-08-20',
        endTime: '20:00',
        location: 'Test Ground',
        address: '456 Test Ave',
        postcode: 'SW1A 1BB',
        requirements: 'Test event for voting',
        gender: 'mixed',
        maxParticipants: 2,
        reserveSpots: 2,
        cost: '5.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      // Vote to attend
      const attendance = await storage.voteOnEvent(event.id, testUserId, 'attending');
      expect(attendance.status).toBe('attending');

      // Get event attendance
      const attendanceList = await storage.getEventAttendance(event.id);
      expect(attendanceList.length).toBe(1);
      expect(attendanceList[0].user.id).toBe(testUserId);
    });

    test('should handle reserve player system', async () => {
      // Create event with limited capacity
      const event = await storage.createEvent({
        name: 'Reserve Test Event',
        sport: 'Football',  
        startDate: '2025-08-25',
        startTime: '19:00',
        endDate: '2025-08-25',
        endTime: '21:00',
        location: 'Small Ground',
        address: '789 Test Road',
        postcode: 'SW1A 1CC',
        requirements: 'Testing reserves',
        gender: 'mixed',
        maxParticipants: 1, // Only 1 main spot
        reserveSpots: 2,
        cost: '8.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      // Create additional test user
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

      // First user votes - should get main spot
      await storage.voteOnEvent(event.id, testUserId, 'attending');

      // Second user votes - should go to reserves since main is full
      await storage.voteOnEvent(event.id, user2.id, 'attending');

      // Get reserve players
      const reserves = await storage.getReservePlayers(event.id);
      expect(reserves.length).toBe(1);
      expect(reserves[0].user.id).toBe(user2.id);

      // Get capacity info
      const capacity = await storage.getEventCapacityInfo(event.id);
      expect(capacity.attendingCount).toBe(1);
      expect(capacity.reserveCount).toBe(1);
      expect(capacity.maxParticipants).toBe(1);
      expect(capacity.reserveSpots).toBe(2);

      // Promote reserve to main (admin overflow allowed)
      await storage.promoteReservePlayer(event.id, user2.id, testUserId);

      // Check capacity after promotion (should show overflow)
      const capacityAfterPromotion = await storage.getEventCapacityInfo(event.id);
      expect(capacityAfterPromotion.attendingCount).toBe(2); // 2/1 (overflow)
      expect(capacityAfterPromotion.reserveCount).toBe(0);
    });

    test('should handle recurring events', async () => {
      const recurringEventData = {
        name: 'Weekly Training',
        sport: 'Football',
        startDate: '2025-08-01',
        startTime: '18:00',
        endTime: '20:00',
        location: 'Training Ground',
        address: '100 Training St',
        postcode: 'SW1A 1EE',
        requirements: 'Weekly training session',
        gender: 'mixed' as const,
        maxParticipants: 20,
        reserveSpots: 5,
        cost: '0.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'weekly' as const,
        recurrenceEndDate: '2025-12-31',
        recurrenceDaysOfWeek: ['friday'],
        endDate: '2025-08-01',
        isRecurringSuspended: false
      };

      const events = await storage.createRecurringEvents(recurringEventData);
      expect(events.length).toBeGreaterThan(5); // Should create multiple weekly events

      // All events should have the same recurring series ID
      const seriesId = events[0].recurringSeriesId;
      expect(seriesId).toBeDefined();
      events.forEach(event => {
        expect(event.recurringSeriesId).toBe(seriesId);
      });

      // Get series events
      const seriesEvents = await storage.getRecurringEventsSeries(seriesId!);
      expect(seriesEvents.length).toBe(events.length);

      // Suspend series
      await storage.suspendRecurringSeries(seriesId!, testUserId);
      const suspendedEvents = await storage.getRecurringEventsSeries(seriesId!);
      suspendedEvents.forEach(event => {
        expect(event.isRecurringSuspended).toBe(true);
      });

      // Resume series
      await storage.resumeRecurringSeries(seriesId!, testUserId);
      const resumedEvents = await storage.getRecurringEventsSeries(seriesId!);
      resumedEvents.forEach(event => {
        expect(event.isRecurringSuspended).toBe(false);
      });
    });
  });

  describe('Event Queries & Filtering', () => {
    test('should get user events', async () => {
      // Create event
      const event = await storage.createEvent({
        name: 'User Event Test',
        sport: 'Tennis',
        startDate: '2025-09-01',
        startTime: '10:00',
        endDate: '2025-09-01',
        endTime: '12:00',
        location: 'Tennis Court',
        address: '200 Tennis Ave',
        postcode: 'SW1A 1FF',
        requirements: 'Bring racket',
        gender: 'mixed',
        maxParticipants: 4,
        reserveSpots: 2,
        cost: '15.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      // Vote on event
      await storage.voteOnEvent(event.id, testUserId, 'attending');

      // Get user events
      const userEvents = await storage.getUserEvents(testUserId);
      expect(userEvents.length).toBeGreaterThan(0);
      expect(userEvents.some(e => e.id === event.id)).toBe(true);
    });

    test('should get team events', async () => {
      const event = await storage.createEvent({
        name: 'Team Event Test',
        sport: 'Basketball',
        startDate: '2025-09-05',
        startTime: '14:00',
        endDate: '2025-09-05',
        endTime: '16:00',
        location: 'Basketball Court',
        address: '300 Basketball St',
        postcode: 'SW1A 1GG',
        requirements: 'Indoor shoes required',
        gender: 'mixed',
        maxParticipants: 10,
        reserveSpots: 3,
        cost: '12.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      const teamEvents = await storage.getTeamEvents(testTeamId);
      expect(teamEvents.length).toBeGreaterThan(0);
      expect(teamEvents.some(e => e.id === event.id)).toBe(true);
    });
  });
});