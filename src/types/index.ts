// Shared domain contracts — RoarPass core concepts
// Merged: identity-onboarding adds FanProfile + onboarding/auth types
// alongside existing Event / CountryCommunity / LocalHelper / CommunityTrip.

export interface Event {
  id: string;
  name: string;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  hostCountryCode: string; // ISO 3166-1 alpha-2
  venues: string[];
}

export interface CountryCommunity {
  id: string;
  countryCode: string; // ISO 3166-1 alpha-2
  displayName: string;
  memberCount: number;
}

export interface LocalHelper {
  id: string;
  fanProfileId: string;
  countryCode: string;
  languages: string[]; // BCP-47 tags
  verified: boolean;
}

export interface CommunityTrip {
  id: string;
  countryCommunityId: string;
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
}

// --- identity-onboarding additions ---

export type AuthProvider = 'email' | 'apple' | 'google';

export interface FanProfile {
  id: string;
  displayName: string;
  countryCode: string;          // ISO 3166-1 alpha-2, home country
  preferredLanguage: string;    // BCP-47
  authProvider: AuthProvider;
  consent: ConsentRecord;       // GDPR/CCPA consent state
  createdAt: string;            // ISO 8601
  onboardingComplete: boolean;
}

export interface ConsentRecord {
  marketingOptIn: boolean;
  dataProcessingAcceptedAt: string | null; // ISO 8601, null until accepted
  policyVersion: string;
}

export interface OnboardingState {
  fanProfileId: string;
  step: OnboardingStep;
  completedSteps: OnboardingStep[];
}

export type OnboardingStep =
  | 'welcome'
  | 'auth'
  | 'profile'
  | 'country-community'
  | 'consent'
  | 'done';