import { describe, it, expect } from 'vitest';
import { selectLocalizedContent } from './officialInfoService';
import type { OfficialInfoLayer, OfficialInfoContent } from '../types/event';

describe('officialInfoService', () => {
  describe('selectLocalizedContent', () => {
    const enContent: OfficialInfoContent = { summary: 'English summary' };
    const frContent: OfficialInfoContent = { summary: 'French summary' };
    const arEGContent: OfficialInfoContent = { summary: 'Arabic (Egypt) summary' };
    const esContent: OfficialInfoContent = { summary: 'Spanish summary' };

    const mockLayer: OfficialInfoLayer = {
      source: 'official',
      verifiedAt: '2023-01-01T00:00:00Z',
      defaultLocale: 'en',
      localizedContent: {
        'en': enContent,
        'fr': frContent,
        'ar-EG': arEGContent,
        'es': esContent,
      },
    };

    it('should return exact match when locale matches exactly', () => {
      const result = selectLocalizedContent(mockLayer, 'fr');
      expect(result).toBe(frContent);
    });

    it('should fallback to language-only (sub-language request -> base language available)', () => {
      // requested "fr-CA" -> matches "fr"
      const result = selectLocalizedContent(mockLayer, 'fr-CA');
      expect(result).toBe(frContent);
    });

    it('should fallback to sub-language (base language request -> sub-language available)', () => {
      // requested "ar" -> matches "ar-EG"
      const result = selectLocalizedContent(mockLayer, 'ar');
      expect(result).toBe(arEGContent);
    });

    it('should fallback to default locale when no match is found', () => {
      const result = selectLocalizedContent(mockLayer, 'de');
      expect(result).toBe(enContent);
    });
  });
});
