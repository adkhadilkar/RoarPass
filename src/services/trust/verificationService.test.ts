import { describe, it, expect } from 'vitest';
import { computeTrustScore } from './verificationService';

describe('verificationService', () => {
  describe('computeTrustScore', () => {
    it('returns 0 for unverified, regardless of isLocalHelper', () => {
      expect(computeTrustScore({ tier: 'unverified' }, false)).toBe(0);
      expect(computeTrustScore({ tier: 'unverified' }, true)).toBe(0);
    });

    it('returns correct base scores for non-helpers', () => {
      expect(computeTrustScore({ tier: 'email' }, false)).toBe(25);
      expect(computeTrustScore({ tier: 'id' }, false)).toBe(60);
      expect(computeTrustScore({ tier: 'trusted' }, false)).toBe(90);
    });

    it('adds 10 points for local helpers', () => {
      expect(computeTrustScore({ tier: 'email' }, true)).toBe(35);
      expect(computeTrustScore({ tier: 'id' }, true)).toBe(70);
    });

    it('caps the score at 100 for trusted local helpers', () => {
      // base score 90 + 10 helper bonus = 100
      expect(computeTrustScore({ tier: 'trusted' }, true)).toBe(100);
    });
  });
});
