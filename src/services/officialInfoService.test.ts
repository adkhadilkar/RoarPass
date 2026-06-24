import { describe, it, expect } from 'vitest';
import {
  resolveOfficialInfo,
  selectLocalizedContent,
  isVerified,
} from './officialInfoService';
import type { Event, OfficialInfoLayer, OfficialInfoContent } from '../types/event';

describe('officialInfoService', () => {
  const mockContentEn: OfficialInfoContent = { summary: 'English summary' };
  const mockContentFr: OfficialInfoContent = { summary: 'French summary' };
  const mockContentEsMx: OfficialInfoContent = { summary: 'Spanish (Mexico) summary' };
  const mockContentEs: OfficialInfoContent = { summary: 'Spanish summary' };
  const mockContentPt: OfficialInfoContent = { summary: 'Portuguese summary' };

  const mockLayer: OfficialInfoLayer = {
    source: 'official',
    verifiedAt: '2023-01-01T00:00:00Z',
    defaultLocale: 'en',
    localizedContent: {
      'en': mockContentEn,
      'fr': mockContentFr,
      'es-MX': mockContentEsMx,
      'es': mockContentEs,
      'pt': mockContentPt,
    },
  };

  const mockEvent: Event = {
    id: 'e1',
    slug: 'e1',
    name: 'Event 1',
    startsAt: '2023-01-01T00:00:00Z',
    endsAt: '2023-01-02T00:00:00Z',
    venue: {
      id: 'v1',
      name: 'Venue 1',
      city: 'City 1',
      countryCode: 'US',
    },
    countryCommunityId: 'c1',
    officialInfo: mockLayer,
  };

  describe('resolveOfficialInfo', () => {
    it('returns null if event has no officialInfo', () => {
      const eventWithoutInfo = { ...mockEvent, officialInfo: undefined };
      expect(resolveOfficialInfo(eventWithoutInfo, 'en')).toBeNull();
    });

    it('delegates to selectLocalizedContent when officialInfo is present', () => {
      expect(resolveOfficialInfo(mockEvent, 'fr')).toBe(mockContentFr);
    });
  });

  describe('selectLocalizedContent', () => {
    it('returns exact match', () => {
      expect(selectLocalizedContent(mockLayer, 'fr')).toBe(mockContentFr);
      expect(selectLocalizedContent(mockLayer, 'es-MX')).toBe(mockContentEsMx);
    });

    it('returns base language match if exact match is not found', () => {
      // requested 'pt-BR', finds 'pt'
      expect(selectLocalizedContent(mockLayer, 'pt-BR')).toBe(mockContentPt);
    });

    it('returns first base language match if multiple exist and exact is missing', () => {
      const layerWithMultipleEs: OfficialInfoLayer = {
        ...mockLayer,
        localizedContent: {
          'en': mockContentEn,
          'es-MX': mockContentEsMx,
          'es-ES': { summary: 'Spanish (Spain)' },
        },
      };
      // requested 'es-AR', falls back to base 'es', which matches 'es-MX'
      expect(selectLocalizedContent(layerWithMultipleEs, 'es-AR')).toBe(mockContentEsMx);
    });

    it('falls back to defaultLocale if no exact or base match is found', () => {
      expect(selectLocalizedContent(mockLayer, 'de')).toBe(mockContentEn);
      expect(selectLocalizedContent(mockLayer, 'de-DE')).toBe(mockContentEn);
    });
  });

  describe('isVerified', () => {
    it('returns true if source is official and verifiedAt is present', () => {
      expect(isVerified(mockLayer)).toBe(true);
    });

    it('returns false if verifiedAt is missing', () => {
      const unverifiedLayer: OfficialInfoLayer = { ...mockLayer, verifiedAt: '' };
      expect(isVerified(unverifiedLayer)).toBe(false);
    });

    it('returns false if source is not official', () => {
      const unofficialLayer = { ...mockLayer, source: 'unofficial' } as any;
      expect(isVerified(unofficialLayer)).toBe(false);
    });
  });
});
