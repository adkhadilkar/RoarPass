import { CommunityTrip } from '../models/CommunityTrip';
import { Event } from '../models/Event';
import { FanProfile } from '../models/FanProfile';
import { LocalHelper } from '../models/LocalHelper';
import { AiContext, callAiModel } from './aiService';

export interface TripAssistantRequest {
  fanProfile: FanProfile;
  event: Event;
  trip?: CommunityTrip;
  locale: string;
  rtl: boolean;
}

export interface TripAssistantSuggestion {
  summary: string;
  suggestedHelpers: LocalHelper[];
  itinerary: { day: number; activities: string[] }[];
}

/**
 * AI Trip Assistant: generates itinerary + helper suggestions for a fan's
 * Community Trip tied to an Event within a Country Community.
 * Uses shared aiService primitives (callAiModel) to keep contracts consistent.
 */
export async function generateTripSuggestion(
  req: TripAssistantRequest
): Promise<TripAssistantSuggestion> {
  const context: AiContext = {
    locale: req.locale,
    rtl: req.rtl,
    fanProfile: {
      id: req.fanProfile.id,
      locale: req.fanProfile.locale,
      interests: req.fanProfile.interests,
    },
  };

  const prompt = buildTripPrompt(req);
  const raw = await callAiModel(prompt, context);
  return parseTripSuggestion(raw);
}

function buildTripPrompt(req: TripAssistantRequest): string {
  // Privacy: only non-PII profile fields (interests/locale) included in prompt.
  return [
    `Event: ${req.event.name} (${req.event.countryCommunityId})`,
    `Locale: ${req.locale}`,
    `Interests: ${req.fanProfile.interests.join(', ')}`,
    req.trip ? `Existing trip: ${req.trip.id}` : 'No existing trip',
  ].join('\n');
}

export function parseTripSuggestion(raw: string): TripAssistantSuggestion {
  // Defensive parse; provider output treated as untrusted data.
  try {
    const parsed = JSON.parse(raw);
    return {
      summary: String(parsed.summary ?? ''),
      suggestedHelpers: Array.isArray(parsed.suggestedHelpers)
        ? parsed.suggestedHelpers
        : [],
      itinerary: Array.isArray(parsed.itinerary) ? parsed.itinerary : [],
    };
  } catch {
    return { summary: '', suggestedHelpers: [], itinerary: [] };
  }
}