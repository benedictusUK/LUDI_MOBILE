import { describe, test, expect, beforeEach } from '@jest/globals';
import { DatabaseStorage } from '../server/storage';

describe('Team Management', () => {
  let storage: DatabaseStorage;
  let testUser1Id: string;
  let testUser2Id: string;
  let testTeamId: string;

  beforeEach(async () => {
    storage = new DatabaseStorage();

    // Create test users
    const user1 = await storage.upsertUser({
      email: 'owner@example.com',
      firstName: 'Team',
      lastName: 'Owner',
      username: 'teamowner',
      phoneNumber: '+441234567890',
      dateOfBirth: '1990-01-01',
      postcode: 'SW1A 1AA',
      gender: 'male',
      sportsInterests: ['Football'],
      travelRadius: 15
    });
    testUser1Id = user1.id;

    const user2 = await storage.upsertUser({
      email: 'member@example.com',
      firstName: 'Team',
      lastName: 'Member',
      username: 'teammember',
      phoneNumber: '+441234567891',
      dateOfBirth: '1991-01-01',
      postcode: 'SW1A 1BB',
      gender: 'female',
      sportsInterests: ['Football'],
      travelRadius: 10
    });
    testUser2Id = user2.id;
  });

  describe('Team Creation & Management', () => {
    test('should create team successfully', async () => {
      const teamData = {
        name: 'Test Football Team',
        sports: ['Football'],
        description: 'A test football team',
        gender: 'mixed' as const,
        maxPlayers: 11,
        isPrivate: false,
        requiresApproval: true
      };

      const team = await storage.createTeam(teamData, testUser1Id);
      testTeamId = team.id;

      expect(team.name).toBe(teamData.name);
      expect(team.ownerId).toBe(testUser1Id);
      expect(team.sports).toEqual(teamData.sports);
    });

    test('should add and remove team members', async () => {
      // Create team first
      const team = await storage.createTeam({
        name: 'Membership Test Team',
        sports: ['Football'],
        description: 'Testing membership',
        gender: 'mixed',
        maxPlayers: 11,
        isPrivate: false,
        requiresApproval: false
      }, testUser1Id);

      // Add member
      const membership = await storage.addTeamMember(team.id, testUser2Id, 'member');
      expect(membership.userId).toBe(testUser2Id);
      expect(membership.teamId).toBe(team.id);

      // Get team members (should have owner + added member = 2)
      const members = await storage.getTeamMembers(team.id);
      expect(members.length).toBe(2);
      expect(members.some(m => m.user.id === testUser2Id)).toBe(true);

      // Remove member
      await storage.removeTeamMember(team.id, testUser2Id);
      const membersAfterRemoval = await storage.getTeamMembers(team.id);
      expect(membersAfterRemoval.length).toBe(1); // Only owner remains
    });

    test('should handle member role updates', async () => {
      // Create unique user for this test
      const roleTestUser = await storage.upsertUser({
        email: 'roletest@example.com',
        firstName: 'Role',
        lastName: 'Test',
        username: 'roletest',
        phoneNumber: '+441234567897',
        dateOfBirth: '1992-01-01',
        postcode: 'SW1A 1DD',
        gender: 'male',
        sportsInterests: ['Football'],
        travelRadius: 12
      });

      const team = await storage.createTeam({
        name: 'Role Test Team',
        sports: ['Football'],
        description: 'Testing roles',
        gender: 'mixed',
        maxPlayers: 11,
        isPrivate: false,
        requiresApproval: false
      }, testUser1Id);

      await storage.addTeamMember(team.id, roleTestUser.id, 'member');

      // Update role to admin
      const updatedMembership = await storage.updateMemberRole(
        team.id, 
        roleTestUser.id, 
        'admin', 
        testUser1Id
      );
      expect(updatedMembership.role).toBe('admin');
    });

    test('should block and unblock members', async () => {
      // Create unique user for this test
      const blockTestUser = await storage.upsertUser({
        email: 'blocktest@example.com',
        firstName: 'Block',
        lastName: 'Test',
        username: 'blocktest',
        phoneNumber: '+441234567898',
        dateOfBirth: '1993-01-01',
        postcode: 'SW1A 1EE',
        gender: 'female',
        sportsInterests: ['Football'],
        travelRadius: 8
      });

      const team = await storage.createTeam({
        name: 'Block Test Team',
        sports: ['Football'],
        description: 'Testing blocking',
        gender: 'mixed',
        maxPlayers: 11,
        isPrivate: false,
        requiresApproval: false
      }, testUser1Id);

      await storage.addTeamMember(team.id, blockTestUser.id, 'member');

      // Block member
      const blockedMember = await storage.blockMember(
        team.id, 
        blockTestUser.id, 
        testUser1Id, 
        'Inappropriate behavior'
      );
      expect(blockedMember.userId).toBe(blockTestUser.id);
      expect(blockedMember.reason).toBe('Inappropriate behavior');

      // Check if user is blocked
      const isBlocked = await storage.isUserBlocked(team.id, blockTestUser.id);
      expect(isBlocked).toBe(true);

      // Get blocked members
      const blockedMembers = await storage.getBlockedMembers(team.id);
      expect(blockedMembers.length).toBe(1);
      expect(blockedMembers[0].user.id).toBe(blockTestUser.id);

      // Unblock member
      await storage.unblockMember(team.id, blockTestUser.id);
      const isStillBlocked = await storage.isUserBlocked(team.id, blockTestUser.id);
      expect(isStillBlocked).toBe(false);
    });

    test('should search teams', async () => {
      // Create unique user for this test
      const searchTestUser = await storage.upsertUser({
        email: 'searchtest@example.com',
        firstName: 'Search',
        lastName: 'Test',
        username: 'searchtest',
        phoneNumber: '+441234567899',
        dateOfBirth: '1994-01-01',
        postcode: 'SW1A 1FF',
        gender: 'male',
        sportsInterests: ['Football', 'Tennis'],
        travelRadius: 20
      });

      // Create multiple teams
      await storage.createTeam({
        name: 'Manchester United FC',
        sports: ['Football'],
        description: 'Professional football team',
        gender: 'male',
        maxPlayers: 11,
        isPrivate: false,
        requiresApproval: true
      }, testUser1Id);

      await storage.createTeam({
        name: 'London Tennis Club',
        sports: ['Tennis'],
        description: 'Tennis club in London',
        gender: 'mixed',
        maxPlayers: null,
        isPrivate: false,
        requiresApproval: false
      }, testUser1Id);

      // Search for football teams by name
      const footballTeams = await storage.searchTeams('Manchester', searchTestUser.id);
      expect(footballTeams.length).toBeGreaterThan(0);
      expect(footballTeams[0].name).toContain('Manchester');

      // Search for tennis teams by name
      const tennisTeams = await storage.searchTeams('London', searchTestUser.id);
      expect(tennisTeams.length).toBeGreaterThan(0);
      expect(tennisTeams[0].name).toContain('London');
    });
  });
});