import { describe, it, expect, vi, beforeEach } from 'vitest';
import { helperNetworkService } from './helperNetwork';
import { db } from '../db';
import { logger } from '../utils/logger';

vi.mock('../db', () => ({
  db: {
    fanProfiles: { findById: vi.fn() },
    events: { findById: vi.fn() },
    countryCommunities: { findByCountry: vi.fn() },
    communityTrips: { findById: vi.fn() },
    localHelpers: { findAvailable: vi.fn() },
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
    it('throws Error when FanProfile is not found', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue(null);

      await expect(
        helperNetworkService.findHelpers({
          eventId: 'evt-1',
          fanProfileId: 'fan-1',
          destinationCountry: 'JP',
        }),
      ).rejects.toThrow('FanProfile not found: fan-1');
    });

    it('throws Error when Event is not found', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1', languages: ['en'] } as any);
      vi.mocked(db.events.findById).mockResolvedValue(null);

      await expect(
        helperNetworkService.findHelpers({
          eventId: 'evt-1',
          fanProfileId: 'fan-1',
          destinationCountry: 'JP',
        }),
      ).rejects.toThrow('Event not found: evt-1');
    });

    it('returns empty array when CountryCommunity is not found', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1', languages: ['en'] } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue(null);

      const result = await helperNetworkService.findHelpers({
        eventId: 'evt-1',
        fanProfileId: 'fan-1',
        destinationCountry: 'JP',
      });

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith('No CountryCommunity for destination', { destinationCountry: 'JP' });
    });

    it('throws Error when CommunityTrip does not match the Event', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1', languages: ['en'] } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue({ id: 'com-1' } as any);
      vi.mocked(db.communityTrips.findById).mockResolvedValue({ id: 'trip-1', eventId: 'evt-2' } as any);

      await expect(
        helperNetworkService.findHelpers({
          eventId: 'evt-1',
          fanProfileId: 'fan-1',
          destinationCountry: 'JP',
          tripId: 'trip-1',
        }),
      ).rejects.toThrow('CommunityTrip trip-1 does not belong to Event evt-1');
    });

    it('successfully finds and scores helpers without a trip', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1', languages: ['en'] } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);

      const mockCommunity = { id: 'com-1' };
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue(mockCommunity as any);

      const mockHelpers = [
        { id: 'h1', languages: ['en'], rating: 4, availableForTrips: false },
        { id: 'h2', languages: ['en', 'fr'], rating: 5, availableForTrips: true },
        { id: 'h3', languages: ['es'], rating: 4, availableForTrips: true }, // No language overlap
      ];
      vi.mocked(db.localHelpers.findAvailable).mockResolvedValue(mockHelpers as any);

      const result = await helperNetworkService.findHelpers({
        eventId: 'evt-1',
        fanProfileId: 'fan-1',
        destinationCountry: 'JP',
        languages: ['en'], // Explicit languages request
      });

      // Score calc:
      // h1: score = 1 + (overlap: 1 * 2) + rating(4) = 7
      // h2: score = 1 + (overlap: 1 * 2) + rating(5) = 8
      // h3: score = 1 + (overlap: 0) -> overlap 0 returns 0 score overall

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        helper: mockHelpers[1], // h2 with score 8
        community: mockCommunity,
        score: 8,
      });
      expect(result[1]).toEqual({
        helper: mockHelpers[0], // h1 with score 7
        community: mockCommunity,
        score: 7,
      });
    });

    it('successfully finds and scores helpers with a trip, respecting limit and sorting by score', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1', languages: ['en', 'es'] } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);

      const mockCommunity = { id: 'com-1' };
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue(mockCommunity as any);

      const mockTrip = { id: 'trip-1', eventId: 'evt-1', startDate: new Date('2024-01-01'), endDate: new Date('2024-01-10') };
      vi.mocked(db.communityTrips.findById).mockResolvedValue(mockTrip as any);

      const mockHelpers = [
        { id: 'h1', languages: ['en'], rating: 4, availableForTrips: true },
        { id: 'h2', languages: ['es'], rating: 3, availableForTrips: false },
        { id: 'h3', languages: ['en', 'es'], rating: 5, availableForTrips: true },
        { id: 'h4', languages: ['en'], rating: 4, availableForTrips: true },
      ];
      vi.mocked(db.localHelpers.findAvailable).mockResolvedValue(mockHelpers as any);

      const result = await helperNetworkService.findHelpers({
        eventId: 'evt-1',
        fanProfileId: 'fan-1',
        destinationCountry: 'JP',
        tripId: 'trip-1',
        limit: 2,
      });

      expect(db.localHelpers.findAvailable).toHaveBeenCalledWith({
        communityId: 'com-1',
        languages: ['en', 'es'], // falls back to fan's languages
        window: { start: mockTrip.startDate, end: mockTrip.endDate }
      });

      // Score calc:
      // desired: ['en', 'es']
      // h1 (en): score = 1 + (overlap: 1*2) + trip(1) + rating(4) = 8
      // h2 (es): score = 1 + (overlap: 1*2) + trip(0) + rating(3) = 6
      // h3 (en, es): score = 1 + (overlap: 2*2) + trip(1) + rating(5) = 11
      // h4 (en): score = 1 + (overlap: 1*2) + trip(1) + rating(4) = 8

      expect(result).toHaveLength(2); // due to limit
      expect(result[0].helper.id).toBe('h3'); // score 11
      // For the tie, javascript sort is usually stable but could be h1 or h4.
      // But we just verify the scores
      expect(result[0].score).toBe(11);
      expect(result[1].score).toBe(8);
    });

    it('filters out helpers with 0 language overlap', async () => {
      vi.mocked(db.fanProfiles.findById).mockResolvedValue({ id: 'fan-1', languages: ['es'] } as any);
      vi.mocked(db.events.findById).mockResolvedValue({ id: 'evt-1' } as any);
      vi.mocked(db.countryCommunities.findByCountry).mockResolvedValue({ id: 'com-1' } as any);

      const mockHelpers = [
        { id: 'h1', languages: ['en'], rating: 5, availableForTrips: true }, // No overlap
        { id: 'h2', languages: ['es'], rating: 3, availableForTrips: false }, // Overlap
      ];
      vi.mocked(db.localHelpers.findAvailable).mockResolvedValue(mockHelpers as any);

      const result = await helperNetworkService.findHelpers({
        eventId: 'evt-1',
        fanProfileId: 'fan-1',
        destinationCountry: 'JP',
      });

      expect(result).toHaveLength(1);
      expect(result[0].helper.id).toBe('h2');
    });
  });
});
