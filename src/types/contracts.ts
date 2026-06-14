// Shared cross-chunk contracts. Both intents preserved.
export type { FanProfile } from './fanProfile';
export type { CountryCommunity } from './countryCommunity';

// event-registry shared contract.
// Event references CountryCommunity via countryCode to stay consistent
// with the existing Country Community concept.
export interface Event {
  id: string;
  title: string;
  description: string;
  startsAt: string; // ISO 8601
  endsAt: string;   // ISO 8601
  venue: string;
  countryCode: string; // FK alignment with CountryCommunity
  capacity: number;
  status: 'draft' | 'published' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  fanProfileId: string; // FK alignment with FanProfile
  registeredAt: string;
  state: 'reserved' | 'confirmed' | 'waitlisted' | 'cancelled';
}