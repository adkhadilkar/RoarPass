import type {
  FanProfile,
  VerificationStatus,
  VerificationTier,
} from '../../types/fanProfile';

const TIER_WEIGHTS: Record<VerificationTier, number> = {
  unverified: 0,
  email: 25,
  id: 60,
  trusted: 90,
};

/**
 * Derives a 0–100 trust score from a fan's verification status and
 * Local Helper standing. Pure function — no PII is logged or persisted here.
 */
export function computeTrustScore(
  status: Omit<VerificationStatus, 'trustScore'>,
  isLocalHelper: boolean,
): number {
  let score = TIER_WEIGHTS[status.tier];
  if (isLocalHelper && status.tier !== 'unverified') {
    score = Math.min(100, score + 10);
  }
  return score;
}

/**
 * Recomputes and returns an updated FanProfile verification block.
 * Caller is responsible for persistence and audit logging.
 */
export function refreshVerification(profile: FanProfile): FanProfile {
  const trustScore = computeTrustScore(
    profile.verification,
    profile.isLocalHelper,
  );
  return {
    ...profile,
    verification: { ...profile.verification, trustScore },
    updatedAt: new Date().toISOString(),
  };
}

export function meetsTier(
  status: VerificationStatus,
  required: VerificationTier,
): boolean {
  return TIER_WEIGHTS[status.tier] >= TIER_WEIGHTS[required];
}