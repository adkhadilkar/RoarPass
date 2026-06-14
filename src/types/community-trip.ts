import type { FanProfile } from './fan-profile';
import type { Event } from './event';
import type { CountryCommunity } from './country-community';
import type { LocalHelper } from './local-helper';

/**
 * A Community Trip groups fans from a Country Community traveling to an Event,
 * optionally supported by Local Helpers, with a shared Itinerary.
 */
export interface CommunityTrip {
  id: string;
  eventId: Event['id'];
  communityId: CountryCommunity['id'];
  organizerProfileId: FanProfile['id'];
  helperIds: LocalHelper['id'][];
  title: string;
  status: 'draft' | 'open' | 'full' | 'completed' | 'cancelled';
  itinerary: TripItinerary;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ordered set of itinerary days, each containing time-ordered stops.
 * Introduced by the trip-itinerary chunk.
 */
export interface TripItinerary {
  tripId: CommunityTrip['id'];
  timezone: string; // IANA tz of the host city
  days: ItineraryDay[];
}

export interface ItineraryDay {
  id: string;
  date: string; // ISO date (YYYY-MM-DD) in trip timezone
  label?: string;
  stops: ItineraryStop[];
}

export interface ItineraryStop {
  id: string;
  startTime: string; // HH:mm in trip timezone
  endTime?: string;
  title: string;
  kind: 'meetup' | 'venue' | 'transport' | 'meal' | 'activity' | 'free';
  location?: ItineraryLocation;
  helperId?: LocalHelper['id'];
  notes?: string;
}

export interface ItineraryLocation {
  label: string;
  lat?: number;
  lng?: number;
  address?: string;
}