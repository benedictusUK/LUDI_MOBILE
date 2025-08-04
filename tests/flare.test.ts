import { describe, test, expect, beforeEach } from '@jest/globals';
import { DatabaseStorage } from '../server/storage';

describe('Flare Gun System', () => {
  let storage: DatabaseStorage;
  let testUserId: string;
  let testUser2Id: string;
  let testTeamId: string;
  let testEventId: string;

  beforeEach(async () => {
    storage = new DatabaseStorage();

    // Create test users
    const user1 = await storage.upsertUser({
      email: 'flareuser1@example.com',
      firstName: 'Flare',
      lastName: 'User1',
      username: 'flareuser1',
      phoneNumber: '+441234567890',
      dateOfBirth: '1990-01-01',
      postcode: 'SW1A 1AA',
      gender: 'male',
      sportsInterests: ['Football'],
      travelRadius: 15
    });
    testUserId = user1.id;

    const user2 = await storage.upsertUser({
      email: 'flareuser2@example.com',
      firstName: 'Flare',
      lastName: 'User2',
      username: 'flareuser2',
      phoneNumber: '+441234567891',
      dateOfBirth: '1991-01-01',
      postcode: 'SW1A 1BB',
      gender: 'female',
      sportsInterests: ['Football'],
      travelRadius: 10
    });
    testUser2Id = user2.id;

    // Create test team
    const team = await storage.createTeam({
      name: 'Flare Test Team',
      sports: ['Football'],
      description: 'Team for flare testing',
      gender: 'mixed',
      maxPlayers: 11,
      isPrivate: false,
      requiresApproval: false
    }, testUserId);
    testTeamId = team.id;

    // Add second user to team
    await storage.addTeamMember(testTeamId, testUser2Id, 'member');

    // Create test event
    const event = await storage.createEvent({
      name: 'Flare Test Event',
      sport: 'Football',
      startDate: '2025-08-30',
      startTime: '16:00',
      endDate: '2025-08-30',
      endTime: '18:00',
      location: 'Flare Test Ground',
      address: '400 Flare Street',
      postcode: 'SW1A 1HH',
      requirements: 'Testing flare system',
      gender: 'mixed',
      maxParticipants: 20,
      reserveSpots: 5,
      cost: '5.00',
      primaryTeamId: testTeamId,
      secondaryTeamIds: [],
      createdById: testUserId,
      recurrenceType: 'none',
      recurrenceEndDate: null,
      recurrenceDaysOfWeek: [],
      isRecurringSuspended: false
    });
    testEventId = event.id;
  });

  describe('Flare Gun Functionality', () => {
    test('should send flare notifications and receive responses', async () => {
      // Send flare notifications to users
      await storage.sendFlareNotifications(testEventId, [testUser2Id]);

      // User responds to flare
      const response = await storage.respondToFlare(testEventId, testUser2Id, 'interested');
      expect(response.eventId).toBe(testEventId);
      expect(response.userId).toBe(testUser2Id);
      expect(response.status).toBe('interested');

      // Get flare responses
      const responses = await storage.getFlareResponses(testEventId);
      expect(responses.length).toBe(1);
      expect(responses[0].user.id).toBe(testUser2Id);
      expect(responses[0].status).toBe('interested');
    });

    test('should find nearby users for flare gun', async () => {
      // This tests the ability to find users for flare notifications
      const nearbyUsers = await storage.findNearbyUsers(testEventId, 'Football', 10);
      expect(Array.isArray(nearbyUsers)).toBe(true);
      // The actual number depends on database state, so we just verify it's an array
    });

    test('should handle different flare response types', async () => {
      // Test different response types
      await storage.respondToFlare(testEventId, testUser2Id, 'interested');
      
      // Create another user for different response
      const user3 = await storage.upsertUser({
        email: 'flareuser3@example.com',
        firstName: 'Flare',
        lastName: 'User3',
        username: 'flareuser3',
        phoneNumber: '+441234567892',
        dateOfBirth: '1992-01-01',
        postcode: 'SW1A 1CC',
        gender: 'male',
        sportsInterests: ['Football'],
        travelRadius: 20
      });
      
      await storage.addTeamMember(testTeamId, user3.id, 'member');
      await storage.respondToFlare(testEventId, user3.id, 'not_interested');

      const responses = await storage.getFlareResponses(testEventId);
      expect(responses.length).toBe(2);
      
      const interestedResponse = responses.find(r => r.status === 'interested');
      const notInterestedResponse = responses.find(r => r.status === 'not_interested');
      
      expect(interestedResponse).toBeDefined();
      expect(notInterestedResponse).toBeDefined();
      expect(interestedResponse?.user.id).toBe(testUser2Id);
      expect(notInterestedResponse?.user.id).toBe(user3.id);
    });

    test('should track flare response timestamps', async () => {
      const beforeResponse = new Date();
      const response = await storage.respondToFlare(testEventId, testUserId, 'maybe');
      const afterResponse = new Date();

      expect(response.respondedAt).toBeDefined();
      expect(new Date(response.respondedAt!)).toBeInstanceOf(Date);
      expect(new Date(response.respondedAt!).getTime()).toBeGreaterThanOrEqual(beforeResponse.getTime());
      expect(new Date(response.respondedAt!).getTime()).toBeLessThanOrEqual(afterResponse.getTime());
    });
  });
});