import { LocalHelper } from './LocalHelper';
import { FanProfile } from './FanProfile';

export interface TripParticipant {
  fanId: string;
  originCity: string;
  joinedAt: Date;
}

export class TripLeg {
  constructor(
    public readonly fromCity: string,
    public readonly toCity: string,
    public readonly waypointCity: string,
    public assignedHelper: LocalHelper | null = null,
  ) {}

  assignHelper(helper: LocalHelper): void {
    this.assignedHelper = helper;
  }
}

interface CommunityTripProps {
  organizerId: string;
  eventId: string;
  communityId: string;
  legs: TripLeg[];
  participants: TripParticipant[];
}

export class CommunityTrip {
  id!: string;
  organizerId: string;
  eventId: string;
  communityId: string;
  legs: TripLeg[];
  participants: TripParticipant[];

  private constructor(props: CommunityTripProps) {
    this.organizerId = props.organizerId;
    this.eventId = props.eventId;
    this.communityId = props.communityId;
    this.legs = props.legs;
    this.participants = props.participants;
  }

  static async create(props: CommunityTripProps): Promise<CommunityTrip> {
    return new CommunityTrip(props);
  }

  // Preserved from main
  addParticipant(fan: FanProfile): TripParticipant {
    const participant: TripParticipant = {
      fanId: fan.id,
      originCity: fan.city,
      joinedAt: new Date(),
    };
    this.participants.push(participant);
    return participant;
  }

  // Added from feat/intercity-coordination
  setLegs(legs: TripLeg[]): void {
    this.legs = legs;
  }
}