import { describe, test, expect, beforeEach } from '@jest/globals';
import { DatabaseStorage } from '../server/storage';

describe('Authentication & User Management', () => {
  let storage: DatabaseStorage;

  beforeEach(async () => {
    storage = new DatabaseStorage();
  });

  describe('User Registration & Profile Management', () => {
    test('should create and update user profile', async () => {
      const userData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        phoneNumber: '+441234567890',
        dateOfBirth: '1990-01-01',
        postcode: 'SW1A 1AA',
        gender: 'male' as const,
        sportsInterests: ['Football', 'Tennis'],
        travelRadius: 15
      };

      // Create user
      const user = await storage.upsertUser(userData);
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);

      // Update profile
      const updatedData = {
        firstName: 'Johnny',
        lastName: 'Smith',
        email: 'johnny@example.com',
        phoneNumber: '+441234567891',
        dateOfBirth: '1990-02-01',
        postcode: 'SW1A 1BB',
        gender: 'male' as const,
        sportsInterests: ['Football', 'Cricket'],
        travelRadius: 20
      };

      const updatedUser = await storage.updateUserProfile(user.id, updatedData);
      expect(updatedUser.firstName).toBe('Johnny');
      expect(updatedUser.email).toBe('johnny@example.com');
    });

    test('should check username availability', async () => {
      const userData = {
        email: 'test2@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        username: 'janedoe',
        phoneNumber: '+441234567892',
        dateOfBirth: '1992-01-01',
        postcode: 'SW1A 1AA',
        gender: 'female' as const,
        sportsInterests: ['Tennis'],
        travelRadius: 10
      };

      await storage.upsertUser(userData);

      // Username should not be available
      const isAvailable = await storage.checkUsernameAvailability('janedoe');
      expect(isAvailable).toBe(false);

      // New username should be available
      const isNewAvailable = await storage.checkUsernameAvailability('newuser');
      expect(isNewAvailable).toBe(true);
    });
  });
});