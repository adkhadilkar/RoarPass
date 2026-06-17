import { describe, it, expect } from 'vitest';
import { computeTrustScore } from './verificationService';
import type { VerificationStatus } from '../../types/fanProfile';

describe('computeTrustScore', () => {
  describe('when isLocalHelper is false', () => {
    it('returns 0 for unverified tier', () => {
      const status: Omit<VerificationStatus, 'trustScore'> = { tier: 'unverified' };
      expect(computeTrustScore(status, false)).toBe(0);
    });

    it('returns 25 for email tier', () => {
      const status: Omit<VerificationStatus, 'trustScore'> = { tier: 'email' };
      expect(computeTrustScore(status, false)).toBe(25);
    });

    it('returns 60 for id tier', () => {
      const status: Omit<VerificationStatus, 'trustScore'> = { tier: 'id' };
      expect(computeTrustScore(status, false)).toBe(60);
    });

    it('returns 90 for trusted tier', () => {
      const status: Omit<VerificationStatus, 'trustScore'> = { tier: 'trusted' };
      expect(computeTrustScore(status, false)).toBe(90);
    });
  });

  describe('when isLocalHelper is true', () => {
    it('returns 0 for unverified tier (no boost for unverified)', () => {
      const status: Omit<VerificationStatus, 'trustScore'> = { tier: 'unverified' };
      expect(computeTrustScore(status, true)).toBe(0);
    });

    it('returns 35 for email tier (+10 boost)', () => {
      const status: Omit<VerificationStatus, 'trustScore'> = { tier: 'email' };
      expect(computeTrustScore(status, true)).toBe(35);
    });

    it('returns 70 for id tier (+10 boost)', () => {
      const status: Omit<VerificationStatus, 'trustScore'> = { tier: 'id' };
      expect(computeTrustScore(status, true)).toBe(70);
    });

    it('returns 100 for trusted tier (+10 boost capped at 100)', () => {
      const status: Omit<VerificationStatus, 'trustScore'> = { tier: 'trusted' };
      expect(computeTrustScore(status, true)).toBe(100);
    });
  });
});
