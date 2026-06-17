import { describe, it, expect } from 'vitest';
import { isVerified } from './officialInfoService';
import type { OfficialInfoLayer } from '../types/event';

describe('officialInfoService', () => {
  describe('isVerified', () => {
    it('returns true when source is official and verifiedAt is provided', () => {
      const layer: OfficialInfoLayer = {
        source: 'official',
        verifiedAt: '2023-10-27T10:00:00Z',
        localizedContent: {},
        defaultLocale: 'en'
      };
      expect(isVerified(layer)).toBe(true);
    });

    it('returns false when verifiedAt is empty', () => {
      const layer: OfficialInfoLayer = {
        source: 'official',
        verifiedAt: '',
        localizedContent: {},
        defaultLocale: 'en'
      };
      expect(isVerified(layer)).toBe(false);
    });

    it('returns false when source is not official', () => {
      // Cast source to any to test the edge case where source is incorrect
      const layer = {
        source: 'community' as any,
        verifiedAt: '2023-10-27T10:00:00Z',
        localizedContent: {},
        defaultLocale: 'en'
      };
      expect(isVerified(layer as OfficialInfoLayer)).toBe(false);
    });
  });
});
