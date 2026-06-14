import { eventsRepo } from './events';
import { countryCommunitiesRepo } from './countryCommunities';
import { fanProfilesRepo } from './fanProfiles';
import { communityTripsRepo } from './communityTrips';
import { localHelpersRepo } from './localHelpers';

/**
 * Central data-access aggregate. The helper-network chunk adds the
 * localHelpers repository; all previously merged repos are preserved.
 */
export const db = {
  events: eventsRepo,
  countryCommunities: countryCommunitiesRepo,
  fanProfiles: fanProfilesRepo,
  communityTrips: communityTripsRepo,
  localHelpers: localHelpersRepo,
};