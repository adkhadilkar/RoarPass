import type { FanProfile } from '../profile/types';
import type { Event } from '../event/types';
import type { LocalHelper } from '../country-community/types';
import type { CommunityTrip } from '../country-community/types';

export interface MatchCandidate {
  helperId: string;
  fanId: string;
  eventId: string;
  tripId?: string;
}

export interface MatchScore {
  total: number; // 0..1 normalized
  components: {
    language: number;
    locality: number;
    interests: number;
    availability: number;
  };
}

export interface MatchResult {
  candidate: MatchCandidate;
  score: MatchScore;
  rationale: string[];
}

// Re-export the shared domain types matching depends on so consumers have a
// single import surface without coupling to other service folders directly.
export type { FanProfile, Event, LocalHelper, CommunityTrip };