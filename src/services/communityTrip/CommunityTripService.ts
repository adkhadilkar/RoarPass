import { Event } from '../../models/Event';
import { CountryCommunity } from '../../models/CountryCommunity';
import { FanProfile } from '../../models/FanProfile';
import { LocalHelper } from '../../models/LocalHelper';
import { CommunityTrip, TripLeg, TripParticipant } from '../../models/CommunityTrip';
import { IntercityCoordinator } from './IntercityCoordinator';

export function extractHelperAssignments(legs: TripLeg[]): Map<string, LocalHelper | null> {
  return new Map(legs.map((l) => [l.waypointCity, l.assignedHelper]));
}

export function restoreHelperAssignments(
  recomputedLegs: TripLeg[],
  previousAssignments: Map<string, LocalHelper | null>,
): void {
  for (const leg of recomputedLegs) {
    if (!leg.assignedHelper && previousAssignments.has(leg.waypointCity)) {
      const prevHelper = previousAssignments.get(leg.waypointCity);
      if (prevHelper) leg.assignHelper(prevHelper);
    }
  }
}

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
    const previous = extractHelperAssignments(trip.legs);
    const recomputed = await this.planIntercityLegs(trip, event);

    restoreHelperAssignments(recomputed, previous);

    return recomputed;
  }
}