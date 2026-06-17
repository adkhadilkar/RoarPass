import { Event } from '../../models/Event';
import { CountryCommunity } from '../../models/CountryCommunity';
import { FanProfile } from '../../models/FanProfile';
import { CommunityTrip, TripLeg, TripParticipant } from '../../models/CommunityTrip';
import { IntercityCoordinator } from './IntercityCoordinator';

/**
 * Merged service combining base Community Trip lifecycle (from main)
 * with intercity-coordination capabilities (from feat/intercity-coordination).
 */
export class CommunityTripService {
  constructor(
    private readonly coordinator: IntercityCoordinator,
  ) {}

  // --- Preserved from main: base trip lifecycle ---

  async createTrip(
    organizer: FanProfile,
    event: Event,
    community: CountryCommunity,
  ): Promise<CommunityTrip> {
    return CommunityTrip.create({
      organizerId: organizer.id,
      eventId: event.id,
      communityId: community.id,
      legs: [],
      participants: [],
    });
  }

  async addParticipant(
    trip: CommunityTrip,
    fan: FanProfile,
  ): Promise<TripParticipant> {
    return trip.addParticipant(fan);
  }

  // --- Added from feat/intercity-coordination: multi-leg routing ---

  /**
   * Plan intercity legs between fan origin cities and the event host city,
   * optionally matching Local Helpers at each waypoint.
   */
  async planIntercityLegs(
    trip: CommunityTrip,
    event: Event,
  ): Promise<TripLeg[]> {
    const legs = await this.coordinator.computeLegs({
      participants: trip.participants,
      destinationCity: event.hostCity,
    });

    for (const leg of legs) {
      const helper = await this.coordinator.matchHelperForLeg(leg);
      if (helper) {
        leg.assignHelper(helper);
      }
    }

    trip.setLegs(legs);
    return legs;
  }

  /**
   * Recompute legs when participants change, preserving existing
   * helper assignments where the waypoint is unchanged.
   */
  async syncLegsAfterParticipantChange(
    trip: CommunityTrip,
    event: Event,
  ): Promise<TripLeg[]> {
    const previous = new Map(
      trip.legs.map((l) => [l.waypointCity, l.assignedHelper]),
    );
    const recomputed = await this.planIntercityLegs(trip, event);

    for (const leg of recomputed) {
      if (!leg.assignedHelper && previous.has(leg.waypointCity)) {
        const prevHelper = previous.get(leg.waypointCity);
        if (prevHelper) leg.assignHelper(prevHelper);
      }
    }
    return recomputed;
  }
}