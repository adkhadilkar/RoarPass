import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshVerification } from './verificationService';
import type { FanProfile } from '../../types/fanProfile';

describe('verificationService', () => {
  describe('refreshVerification', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('updates trustScore for an unverified fan', () => {
      const profile: FanProfile = {
        id: '1',
        displayName: 'Test Fan',
        homeCountry: 'US',
        communities: ['US-community'],
        locale: 'en-US',
        isLocalHelper: false,
        verification: {
          tier: 'unverified',
          trustScore: -1, // Old trust score
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
      };

      const updatedProfile = refreshVerification(profile);

      expect(updatedProfile.verification.trustScore).toBe(0);
      expect(updatedProfile.updatedAt).toBe('2024-01-01T12:00:00.000Z');
      expect(updatedProfile.id).toBe('1');
    });

    it('updates trustScore for a verified fan with email tier', () => {
      const profile: FanProfile = {
        id: '2',
        displayName: 'Test Fan 2',
        homeCountry: 'CA',
        communities: ['CA-community'],
        locale: 'en-CA',
        isLocalHelper: false,
        verification: {
          tier: 'email',
          emailVerifiedAt: '2023-02-01T00:00:00Z',
          trustScore: 10,
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-02-01T00:00:00Z',
      };

      const updatedProfile = refreshVerification(profile);

      expect(updatedProfile.verification.trustScore).toBe(25);
      expect(updatedProfile.updatedAt).toBe('2024-01-01T12:00:00.000Z');
    });

    it('updates trustScore for an ID verified Local Helper', () => {
      const profile: FanProfile = {
        id: '3',
        displayName: 'Test Fan 3',
        homeCountry: 'UK',
        communities: ['UK-community'],
        locale: 'en-GB',
        isLocalHelper: true,
        verification: {
          tier: 'id',
          idVerifiedAt: '2023-03-01T00:00:00Z',
          trustScore: 40,
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-03-01T00:00:00Z',
      };

      const updatedProfile = refreshVerification(profile);

      // 'id' tier base is 60, + 10 for isLocalHelper = 70
      expect(updatedProfile.verification.trustScore).toBe(70);
      expect(updatedProfile.updatedAt).toBe('2024-01-01T12:00:00.000Z');
    });

    it('returns a new object and does not mutate the original profile', () => {
      const profile: FanProfile = {
        id: '4',
        displayName: 'Test Fan 4',
        homeCountry: 'FR',
        communities: ['FR-community'],
        locale: 'fr-FR',
        isLocalHelper: true,
        verification: {
          tier: 'trusted',
          trustedSince: '2023-04-01T00:00:00Z',
          trustScore: 90,
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-04-01T00:00:00Z',
      };

      const updatedProfile = refreshVerification(profile);

      expect(updatedProfile).not.toBe(profile);
      expect(updatedProfile.verification).not.toBe(profile.verification);
      expect(profile.verification.trustScore).toBe(90);
      expect(profile.updatedAt).toBe('2023-04-01T00:00:00Z');
      expect(updatedProfile.verification.trustScore).toBe(100); // 90 base + 10 for local helper, capped at 100
    });
  });
});
