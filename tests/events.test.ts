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
      expect(event.maxParticipants).toBe(22);
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
        email: 'reserve3@example.com',
        firstName: 'Reserve',
        lastName: 'User2',
        username: 'reserveuser3',
        phoneNumber: '+441234567893',
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

    test('should send unvote notifications when player unvotes within 48 hours', async () => {
      // Create an event that starts within 24 hours
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split('T')[0];

      const event = await storage.createEvent({
        name: 'Unvote Notification Test',
        sport: 'Football',
        startDate,
        startTime: '18:00',
        endDate: startDate,
        endTime: '20:00',
        location: 'Test Ground',
        address: '123 Test Street',
        postcode: 'SW1A 1AA',
        requirements: 'Testing unvote notifications',
        gender: 'mixed',
        maxParticipants: 3,
        reserveSpots: 2,
        cost: '10.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      // Create additional test users
      const user2 = await storage.upsertUser({
        email: 'attendee2@example.com',
        firstName: 'Attendee',
        lastName: 'Two',
        username: 'attendee2',
        phoneNumber: '+441234567894',
        dateOfBirth: '1992-01-01',
        postcode: 'SW1A 1BB',
        gender: 'male',
        sportsInterests: ['Football'],
        travelRadius: 15
      });

      const user3 = await storage.upsertUser({
        email: 'attendee3@example.com',
        firstName: 'Attendee',
        lastName: 'Three',
        username: 'attendee3',
        phoneNumber: '+441234567895',
        dateOfBirth: '1993-01-01',
        postcode: 'SW1A 1CC',
        gender: 'female',
        sportsInterests: ['Football'],
        travelRadius: 20
      });

      // All three users vote to attend
      await storage.voteOnEvent(event.id, testUserId, 'attending');
      await storage.voteOnEvent(event.id, user2.id, 'attending');
      await storage.voteOnEvent(event.id, user3.id, 'attending');

      // Check initial attendance
      const initialAttendance = await storage.getEventAttendance(event.id);
      expect(initialAttendance.length).toBe(3);
      expect(initialAttendance.every(a => a.status === 'attending')).toBe(true);

      // Get initial notification count for user2 and user3
      const initialNotificationsUser2 = await storage.getUserNotifications(user2.id);
      const initialNotificationsUser3 = await storage.getUserNotifications(user3.id);

      // First user unvotes (should trigger notifications to the other two)
      await storage.removeVote(event.id, testUserId);

      // Check that unvoter is no longer in attendance
      const finalAttendance = await storage.getEventAttendance(event.id);
      expect(finalAttendance.length).toBe(2);
      expect(finalAttendance.find(a => a.userId === testUserId)).toBeUndefined();

      // Check that notifications were sent to remaining attendees
      const finalNotificationsUser2 = await storage.getUserNotifications(user2.id);
      const finalNotificationsUser3 = await storage.getUserNotifications(user3.id);

      expect(finalNotificationsUser2.length).toBe(initialNotificationsUser2.length + 1);
      expect(finalNotificationsUser3.length).toBe(initialNotificationsUser3.length + 1);

      // Check notification content for user2
      const newNotificationUser2 = finalNotificationsUser2.find(n => 
        n.type === 'event' && n.title === 'Player Unavailable - Need Replacement'
      );
      expect(newNotificationUser2).toBeDefined();
      expect(newNotificationUser2!.message).toContain('has unvoted for the event');
      expect(newNotificationUser2!.message).toContain('Can you field another player?');
      expect(newNotificationUser2!.relatedId).toBe(event.id);

      // Check notification content for user3
      const newNotificationUser3 = finalNotificationsUser3.find(n => 
        n.type === 'event' && n.title === 'Player Unavailable - Need Replacement'
      );
      expect(newNotificationUser3).toBeDefined();
      expect(newNotificationUser3!.message).toContain('has unvoted for the event');
      expect(newNotificationUser3!.message).toContain('Can you field another player?');
      expect(newNotificationUser3!.relatedId).toBe(event.id);
    });

    test('should NOT send unvote notifications when event is more than 48 hours away', async () => {
      // Create an event that starts in 3 days (more than 48 hours)
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const startDate = threeDaysFromNow.toISOString().split('T')[0];

      const event = await storage.createEvent({
        name: 'No Notification Test',
        sport: 'Football',
        startDate,
        startTime: '18:00',
        endDate: startDate,
        endTime: '20:00',
        location: 'Test Ground',
        address: '456 Test Street',
        postcode: 'SW1A 1DD',
        requirements: 'Testing no notifications for early unvotes',
        gender: 'mixed',
        maxParticipants: 2,
        reserveSpots: 1,
        cost: '5.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      // Create additional test user
      const user4 = await storage.upsertUser({
        email: 'early-attendee@example.com',
        firstName: 'Early',
        lastName: 'Attendee',
        username: 'earlyattendee',
        phoneNumber: '+441234567896',
        dateOfBirth: '1994-01-01',
        postcode: 'SW1A 1EE',
        gender: 'male',
        sportsInterests: ['Football'],
        travelRadius: 5
      });

      // Both users vote to attend
      await storage.voteOnEvent(event.id, testUserId, 'attending');
      await storage.voteOnEvent(event.id, user4.id, 'attending');

      // Get initial notification count
      const initialNotifications = await storage.getUserNotifications(user4.id);

      // First user unvotes (should NOT trigger notifications as event is >48h away)
      await storage.removeVote(event.id, testUserId);

      // Check that no new notifications were sent
      const finalNotifications = await storage.getUserNotifications(user4.id);
      expect(finalNotifications.length).toBe(initialNotifications.length);
    });

    test('should exclude blocked users from flare gun notifications', async () => {
      // Create event with flare gun capability
      const event = await storage.createEvent({
        name: 'Flare Gun Block Test',
        sport: 'Football',
        startDate: '2025-08-30',
        startTime: '19:00',
        endDate: '2025-08-30',
        endTime: '21:00',
        location: 'Test Stadium',
        address: '789 Test Street',
        postcode: 'SW1A 1FF',
        requirements: 'Testing flare gun blocking',
        gender: 'mixed',
        maxParticipants: 5,
        reserveSpots: 2,
        cost: '12.00',
        primaryTeamId: testTeamId,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      // Create two test users
      const user1 = await storage.upsertUser({
        email: 'flare-user1@example.com',
        firstName: 'Flare',
        lastName: 'User1',
        username: 'flareuser1',
        phoneNumber: '+441234567897',
        dateOfBirth: '1995-01-01',
        postcode: 'SW1A 1GG',
        gender: 'male',
        sportsInterests: ['Football'],
        travelRadius: 10
      });

      const user2 = await storage.upsertUser({
        email: 'flare-user2@example.com',
        firstName: 'Flare',
        lastName: 'User2',
        username: 'flareuser2',
        phoneNumber: '+441234567898',
        dateOfBirth: '1996-01-01',
        postcode: 'SW1A 1HH',
        gender: 'female',
        sportsInterests: ['Football'],
        travelRadius: 10
      });

      // Block user2 from the team
      await storage.blockMember(testTeamId, user2.id, testUserId, 'Testing flare blocking');

      // Get initial notification counts
      const initialNotificationsUser1 = await storage.getUserNotifications(user1.id);
      const initialNotificationsUser2 = await storage.getUserNotifications(user2.id);

      // Send flare notifications to both users
      await storage.sendFlareNotifications(event.id, [user1.id, user2.id]);

      // Check final notification counts
      const finalNotificationsUser1 = await storage.getUserNotifications(user1.id);
      const finalNotificationsUser2 = await storage.getUserNotifications(user2.id);

      // User1 should receive notification (not blocked)
      expect(finalNotificationsUser1.length).toBe(initialNotificationsUser1.length + 1);
      const flareNotification1 = finalNotificationsUser1.find(n => n.type === 'flare_gun');
      expect(flareNotification1).toBeDefined();
      expect(flareNotification1!.title).toBe('🚀 Flare Gun Alert!');

      // User2 should NOT receive notification (blocked)
      expect(finalNotificationsUser2.length).toBe(initialNotificationsUser2.length);
      const flareNotification2 = finalNotificationsUser2.find(n => n.type === 'flare_gun');
      expect(flareNotification2).toBeUndefined();
    });

    test('should exclude events from blocking teams in flare search', async () => {
      // Create a team and event for the test
      const blockingTeam = await storage.createTeam({
        name: 'Blocking Team Test',
        sports: ['Football'],
        description: 'Team that blocks users',
        gender: 'mixed',
        maxPlayers: 15,
        isPrivate: false,
        requiresApproval: false
      }, testUserId);

      const searchTestEvent = await storage.createEvent({
        name: 'Flare Search Block Test',
        sport: 'Football',
        startDate: '2025-09-01',
        startTime: '18:00',
        endDate: '2025-09-01',
        endTime: '20:00',
        location: 'Search Test Ground',
        address: '123 Search Street',
        postcode: 'SW1A 1XX',
        requirements: 'Testing flare search blocking',
        gender: 'mixed',
        maxParticipants: 6,
        reserveSpots: 2,
        cost: '15.00',
        primaryTeamId: blockingTeam.id,
        secondaryTeamIds: [],
        createdById: testUserId,
        recurrenceType: 'none',
        recurrenceEndDate: null,
        recurrenceDaysOfWeek: [],
        isRecurringSuspended: false
      });

      // Publish event and activate flare
      await storage.updateEvent(searchTestEvent.id, { isPublished: true, flareStatus: 'active' });

      // Create a test user to search
      const searchUser = await storage.upsertUser({
        email: 'search-user@example.com',
        firstName: 'Search',
        lastName: 'User',
        username: 'searchuser',
        phoneNumber: '+441234567899',
        dateOfBirth: '1997-01-01',
        postcode: 'SW1A 1YY',
        gender: 'male',
        sportsInterests: ['Football'],
        travelRadius: 20
      });

      // Search should include the event initially (user not blocked)
      const initialSearchResults = await storage.searchFlareEvents(
        'SW1A 1XX',
        25,
        'Football',
        searchUser.id
      );
      expect(initialSearchResults.some(e => e.id === searchTestEvent.id)).toBe(true);

      // Block the search user from the team
      await storage.blockMember(blockingTeam.id, searchUser.id, testUserId, 'Testing search blocking');

      // Search should exclude the event now (user is blocked)
      const filteredSearchResults = await storage.searchFlareEvents(
        'SW1A 1XX',
        25,
        'Football',
        searchUser.id
      );
      expect(filteredSearchResults.some(e => e.id === searchTestEvent.id)).toBe(false);

      // Search without user ID should still include the event (no filtering)
      const unFilteredSearchResults = await storage.searchFlareEvents(
        'SW1A 1XX',
        25,
        'Football'
      );
      expect(unFilteredSearchResults.some(e => e.id === searchTestEvent.id)).toBe(true);
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
      expect(events.length).toBe(5); // Should create 5 weekly events

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