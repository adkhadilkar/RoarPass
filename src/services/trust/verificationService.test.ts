import { describe, it, expect } from 'vitest';
import { meetsTier } from './verificationService';
import type { VerificationStatus, VerificationTier } from '../../types/fanProfile';

describe('meetsTier', () => {
  const createStatus = (tier: VerificationTier): VerificationStatus => ({
    tier,
    trustScore: 0, // Not used in meetsTier, but required by type
  });

  it('returns true when status tier matches required tier', () => {
    expect(meetsTier(createStatus('unverified'), 'unverified')).toBe(true);
    expect(meetsTier(createStatus('email'), 'email')).toBe(true);
    expect(meetsTier(createStatus('id'), 'id')).toBe(true);
    expect(meetsTier(createStatus('trusted'), 'trusted')).toBe(true);
  });

  it('returns true when status tier is higher than required tier', () => {
    // email > unverified
    expect(meetsTier(createStatus('email'), 'unverified')).toBe(true);

    // id > email, unverified
    expect(meetsTier(createStatus('id'), 'email')).toBe(true);
    expect(meetsTier(createStatus('id'), 'unverified')).toBe(true);

    // trusted > id, email, unverified
    expect(meetsTier(createStatus('trusted'), 'id')).toBe(true);
    expect(meetsTier(createStatus('trusted'), 'email')).toBe(true);
    expect(meetsTier(createStatus('trusted'), 'unverified')).toBe(true);
  });

  it('returns false when status tier is lower than required tier', () => {
    // unverified < email, id, trusted
    expect(meetsTier(createStatus('unverified'), 'email')).toBe(false);
    expect(meetsTier(createStatus('unverified'), 'id')).toBe(false);
    expect(meetsTier(createStatus('unverified'), 'trusted')).toBe(false);

    // email < id, trusted
    expect(meetsTier(createStatus('email'), 'id')).toBe(false);
    expect(meetsTier(createStatus('email'), 'trusted')).toBe(false);

    // id < trusted
    expect(meetsTier(createStatus('id'), 'trusted')).toBe(false);
  });
});
