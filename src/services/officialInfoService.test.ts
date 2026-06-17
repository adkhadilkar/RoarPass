import { describe, it, expect } from 'vitest';
import { resolveOfficialInfo, isVerified } from './officialInfoService';
import type { Event, OfficialInfoLayer } from '../types/event';

describe('officialInfoService', () => {
  describe('resolveOfficialInfo', () => {
    it('should return null if the event does not have officialInfo', () => {
      const event: Event = {
        id: '1',
        slug: 'test-event',
        name: 'Test Event',
        startsAt: '2023-01-01T00:00:00Z',
        endsAt: '2023-01-02T00:00:00Z',
        venue: {
          id: 'v1',
          name: 'Test Venue',
          city: 'Test City',
          countryCode: 'US',
        },
        countryCommunityId: 'c1',
      };

      expect(resolveOfficialInfo(event, 'en-US')).toBeNull();
    });

    it('should return the exact locale content if available', () => {
      const officialInfo: OfficialInfoLayer = {
        source: 'official',
        verifiedAt: '2023-01-01T00:00:00Z',
        defaultLocale: 'en',
        localizedContent: {
          'en-US': { summary: 'English US summary' },
          'en-GB': { summary: 'English GB summary' },
          'en': { summary: 'English fallback summary' },
        },
      };

      const event: Event = {
        id: '1',
        slug: 'test-event',
        name: 'Test Event',
        startsAt: '2023-01-01T00:00:00Z',
        endsAt: '2023-01-02T00:00:00Z',
        venue: {
          id: 'v1',
          name: 'Test Venue',
          city: 'Test City',
          countryCode: 'US',
        },
        countryCommunityId: 'c1',
        officialInfo,
      };

      expect(resolveOfficialInfo(event, 'en-US')).toEqual({ summary: 'English US summary' });
    });

    it('should return the base language content if exact match fails', () => {
      const officialInfo: OfficialInfoLayer = {
        source: 'official',
        verifiedAt: '2023-01-01T00:00:00Z',
        defaultLocale: 'en',
        localizedContent: {
          'en': { summary: 'English fallback summary' },
          'en-GB': { summary: 'English GB summary' },
          'fr': { summary: 'French summary' },
        },
      };

      const event: Event = {
        id: '1',
        slug: 'test-event',
        name: 'Test Event',
        startsAt: '2023-01-01T00:00:00Z',
        endsAt: '2023-01-02T00:00:00Z',
        venue: {
          id: 'v1',
          name: 'Test Venue',
          city: 'Test City',
          countryCode: 'US',
        },
        countryCommunityId: 'c1',
        officialInfo,
      };

      // Request en-US, should fallback to en
      expect(resolveOfficialInfo(event, 'en-US')).toEqual({ summary: 'English fallback summary' });
    });

    it('should return the default locale content if neither exact nor base match is found', () => {
      const officialInfo: OfficialInfoLayer = {
        source: 'official',
        verifiedAt: '2023-01-01T00:00:00Z',
        defaultLocale: 'en',
        localizedContent: {
          'en': { summary: 'English default summary' },
          'fr': { summary: 'French summary' },
        },
      };

      const event: Event = {
        id: '1',
        slug: 'test-event',
        name: 'Test Event',
        startsAt: '2023-01-01T00:00:00Z',
        endsAt: '2023-01-02T00:00:00Z',
        venue: {
          id: 'v1',
          name: 'Test Venue',
          city: 'Test City',
          countryCode: 'US',
        },
        countryCommunityId: 'c1',
        officialInfo,
      };

      // Request es-ES, should fallback to default (en)
      expect(resolveOfficialInfo(event, 'es-ES')).toEqual({ summary: 'English default summary' });
    });
  });

  describe('isVerified', () => {
    it('should return true for a valid, verified official info layer', () => {
      const layer: OfficialInfoLayer = {
        source: 'official',
        verifiedAt: '2023-01-01T00:00:00Z',
        defaultLocale: 'en',
        localizedContent: {},
      };

      expect(isVerified(layer)).toBe(true);
    });

    it('should return false if source is not official', () => {
      const layer = {
        source: 'user',
        verifiedAt: '2023-01-01T00:00:00Z',
        defaultLocale: 'en',
        localizedContent: {},
      } as OfficialInfoLayer;

      expect(isVerified(layer)).toBe(false);
    });

    it('should return false if verifiedAt is not set', () => {
      const layer = {
        source: 'official',
        defaultLocale: 'en',
        localizedContent: {},
      } as OfficialInfoLayer;

      expect(isVerified(layer)).toBe(false);
    });
  });
});
