import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommunityTripService } from './CommunityTripService';
import { CommunityTrip } from '../../models/CommunityTrip';

// Mock the CommunityTrip model since it requires mocking database queries
vi.mock('../../models/CommunityTrip', () => ({
  CommunityTrip: {
    create: vi.fn(),
  },
  TripLeg: vi.fn(),
}));

describe('CommunityTripService', () => {
  let coordinatorMock: any;
  let service: CommunityTripService;

  beforeEach(() => {
    coordinatorMock = {
      computeLegs: vi.fn(),
      matchHelperForLeg: vi.fn(),
    };
    service = new CommunityTripService(coordinatorMock);
    vi.clearAllMocks();
  });

  describe('createTrip', () => {
    it('should create a community trip with empty legs and participants', async () => {
      const organizer: any = { id: 'org1', city: 'CityA' };
      const event: any = { id: 'evt1', hostCity: 'CityZ' };
      const community: any = { id: 'com1' };

      const mockTrip = { id: 'trip1' };
      (CommunityTrip.create as any).mockResolvedValue(mockTrip);

      const trip = await service.createTrip(organizer, event, community);

      expect(CommunityTrip.create).toHaveBeenCalledWith({
        organizerId: 'org1',
        eventId: 'evt1',
        communityId: 'com1',
        legs: [],
        participants: [],
      });
      expect(trip).toBe(mockTrip);
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to a trip', async () => {
      const mockTrip = {
        addParticipant: vi.fn().mockReturnValue({ fanId: 'fan1', originCity: 'CityB' })
      };
      const fan: any = { id: 'fan1', city: 'CityB' };

      const participant = await service.addParticipant(mockTrip as any, fan);

      expect(mockTrip.addParticipant).toHaveBeenCalledWith(fan);
      expect(participant).toEqual({ fanId: 'fan1', originCity: 'CityB' });
    });
  });
});
