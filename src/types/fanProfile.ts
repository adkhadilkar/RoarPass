import type { CountryCommunity } from './countryCommunity';

export type VerificationTier = 'unverified' | 'email' | 'id' | 'trusted';

export interface VerificationStatus {
  tier: VerificationTier;
  emailVerifiedAt?: string;
  idVerifiedAt?: string;
  trustedSince?: string;
  /** Computed trust score 0–100 used for ranking Local Helpers. */
  trustScore: number;
}

export interface FanProfile {
  id: string;
  displayName: string;
  /** ISO 3166-1 alpha-2 country code of the fan's home Country Community. */
  homeCountry: string;
  communities: CountryCommunity['id'][];
  locale: string;
  /** RTL handled at render time from locale; do not store direction here. */
  verification: VerificationStatus;
  isLocalHelper: boolean;
  createdAt: string;
  updatedAt: string;
}