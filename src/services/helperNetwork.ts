import { Event } from '../models/event';
import { CountryCommunity } from '../models/countryCommunity';
import { FanProfile } from '../models/fanProfile';
import { LocalHelper } from '../models/localHelper';
import { CommunityTrip } from '../models/communityTrip';
import { db } from '../db';
import { logger } from '../utils/logger';

/**
 * HelperNetwork service: connects FanProfiles traveling for an Event
 * with LocalHelpers from the destination CountryCommunity, optionally
 * within the scope of a CommunityTrip.
 */
export interface HelperMatchQuery {
  eventId: string;
  fanProfileId: string;
  /** ISO 3166-1 alpha-2 country code of the destination community */
  destinationCountry: string;
  tripId?: string;
  languages?: string[];
  limit?: number;
}

export interface HelperMatch {
  helper: LocalHelper;
  community: CountryCommunity;
  score: number;
}

export class HelperNetworkService {
  /**
   * Find LocalHelpers for a fan attending an event in a destination country.
   * Matching respects helper availability, language overlap, and (if a
   * CommunityTrip is supplied) the trip's date window.
   */
  async findHelpers(query: HelperMatchQuery): Promise<HelperMatch[]> {
    const {
      eventId,
      fanProfileId,
      destinationCountry,
      tripId,
      languages,
      limit = 20,
    } = query;

    const fan = await db.fanProfiles.findById(fanProfileId);
    if (!fan) {
      throw new Error(`FanProfile not found: ${fanProfileId}`);
    }

    const event = await db.events.findById(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const community = await db.countryCommunities.findByCountry(
      destinationCountry,
    );
    if (!community) {
      logger.info('No CountryCommunity for destination', { destinationCountry });
      return [];
    }

    let trip: CommunityTrip | null = null;
    if (tripId) {
      trip = await db.communityTrips.findById(tripId);
      if (trip && trip.eventId !== eventId) {
        throw new Error(
          `CommunityTrip ${tripId} does not belong to Event ${eventId}`,
        );
      }
    }

    // Prefer languages explicitly requested, else fall back to the fan's
    // profile languages so RTL/i18n preferences are honored end-to-end.
    const desiredLanguages =
      languages && languages.length > 0 ? languages : fan.languages ?? [];

    const helpers = await db.localHelpers.findAvailable({
      communityId: community.id,
      languages: desiredLanguages,
      window: trip ? { start: trip.startDate, end: trip.endDate } : undefined,
    });

    const matches = helpers
      .map((helper) => ({
        helper,
        community,
        score: this.scoreHelper(helper, desiredLanguages, trip),
      }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return matches;
  }

  /**
   * Score a helper for a given request. Language overlap is the primary
   * signal; trip-window availability and helper rating refine the ranking.
   */
  private scoreHelper(
    helper: LocalHelper,
    desiredLanguages: string[],
    trip: CommunityTrip | null,
  ): number {
    let score = 1;

    if (desiredLanguages.length > 0) {
      const overlap = helper.languages.filter((l) =>
        desiredLanguages.includes(l),
      ).length;
      if (overlap === 0) {
        return 0;
      }
      score += overlap * 2;
    }

    if (trip && helper.availableForTrips) {
      score += 1;
    }

    if (typeof helper.rating === 'number') {
      score += helper.rating;
    }

    return score;
  }
}

export const helperNetworkService = new HelperNetworkService();