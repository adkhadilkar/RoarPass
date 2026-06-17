import { describe, it, expect, vi, beforeEach } from 'vitest';
import { helperNetworkService } from './helperNetwork';
import { db } from '../db';

vi.mock('../db', () => ({
  db: {
    fanProfiles: {
      findById: vi.fn(),
    },
    events: {
      findById: vi.fn(),
    },
    countryCommunities: {
      findByCountry: vi.fn(),
    },
    communityTrips: {
      findById: vi.fn(),
    },
    localHelpers: {
      findAvailable: vi.fn(),
    },
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

describe('HelperNetworkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findHelpers', () => {
    const baseQuery = {
      eventId: 'evt-1',
      fanProfileId: 'fan-1',
      destinationCountry: 'JP',
    };

    it('throws error when FanProfile is not found', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue(null as any);

      await expect(helperNetworkService.findHelpers(baseQuery)).rejects.toThrow(
        'FanProfile not found: fan-1'
      );
    });

    it('throws error when Event is not found', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1' } as any);
      vi.mocked(db.events.findById).mockResolvedValue(null as any);

      await expect(helperNetworkService.findHelpers(baseQuery)).rejects.toThrow(
        'Event not found: evt-1'
      );
    });

    it('returns empty array when CountryCommunity is not found', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1' } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue(null as any);

      const result = await helperNetworkService.findHelpers(baseQuery);
      expect(result).toEqual([]);
    });

    it('throws error when CommunityTrip is provided but belongs to another event', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1' } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue({ id: 'com-1' } as any);
      vi.mocked(db.communityTrips.findById).mockResolvedValue({
        id: 'trip-1',
        eventId: 'evt-other',
      } as any);

      await expect(
        helperNetworkService.findHelpers({ ...baseQuery, tripId: 'trip-1' })
      ).rejects.toThrow('CommunityTrip trip-1 does not belong to Event evt-1');
    });

    it('falls back to fan profile languages if not provided in query', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({
        id: 'fan-1',
        languages: ['en', 'ja'],
      } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue({ id: 'com-1' } as any);
      vi.mocked(db.localHelpers.findAvailable).mockResolvedValue([]);

      await helperNetworkService.findHelpers(baseQuery);

      expect(db.localHelpers.findAvailable).toHaveBeenCalledWith({
        communityId: 'com-1',
        languages: ['en', 'ja'],
        window: undefined,
      });
    });

    it('prefers languages from query over fan profile languages', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({
        id: 'fan-1',
        languages: ['en', 'ja'],
      } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue({ id: 'com-1' } as any);
      vi.mocked(db.localHelpers.findAvailable).mockResolvedValue([]);

      await helperNetworkService.findHelpers({ ...baseQuery, languages: ['fr'] });

      expect(db.localHelpers.findAvailable).toHaveBeenCalledWith({
        communityId: 'com-1',
        languages: ['fr'],
        window: undefined,
      });
    });

    it('successfully fetches, scores, sorts, and limits helpers', async () => {
      const mockCommunity = { id: 'com-1', country: 'JP' };
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({
        id: 'fan-1',
        languages: ['en', 'ja'],
      } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue(mockCommunity as any);

      const trip = {
        id: 'trip-1',
        eventId: 'evt-1',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-10'),
      };
      vi.mocked(db.communityTrips.findById).mockResolvedValue(trip as any);

      const helpers = [
        { id: 'h1', languages: ['en'], rating: 4.5, availableForTrips: false }, // overlap: 1, base: 1, score: 1 + 2*1 + 4.5 = 7.5
        { id: 'h2', languages: ['en', 'ja'], rating: 5, availableForTrips: true }, // overlap: 2, base: 1, trip: 1, score: 1 + 2*2 + 1 + 5 = 11
        { id: 'h3', languages: ['fr'], rating: 5, availableForTrips: true }, // overlap: 0, score: 0
        { id: 'h4', languages: ['ja'], rating: 3, availableForTrips: false }, // overlap: 1, base: 1, score: 1 + 2*1 + 3 = 6
      ];
      vi.mocked(db.localHelpers.findAvailable).mockResolvedValue(helpers as any);

      const result = await helperNetworkService.findHelpers({
        ...baseQuery,
        tripId: 'trip-1',
        limit: 2,
      });

      expect(db.localHelpers.findAvailable).toHaveBeenCalledWith({
        communityId: 'com-1',
        languages: ['en', 'ja'],
        window: { start: trip.startDate, end: trip.endDate },
      });

      // H2 score: 1 (base) + 2*2 (overlap) + 1 (trip) + 5 (rating) = 11
      // H1 score: 1 (base) + 1*2 (overlap) + 0 (trip) + 4.5 (rating) = 7.5
      // H4 score: 1 (base) + 1*2 (overlap) + 0 (trip) + 3 (rating) = 6
      // H3 score: 0 (no language overlap)

      expect(result).toHaveLength(2); // limited to 2
      expect(result[0].helper.id).toBe('h2');
      expect(result[0].score).toBe(11);
      expect(result[0].community).toEqual(mockCommunity);

      expect(result[1].helper.id).toBe('h1');
      expect(result[1].score).toBe(7.5);
      expect(result[1].community).toEqual(mockCommunity);
    });
  });
});
