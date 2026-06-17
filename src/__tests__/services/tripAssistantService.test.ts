import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/aiService', () => ({
  callAiModel: vi.fn(),
}));

import { parseTripSuggestion } from '../../services/tripAssistantService';

describe('parseTripSuggestion', () => {
  it('should return a fallback object when fed bad JSON', () => {
    const raw = 'this is not valid json';
    const result = parseTripSuggestion(raw);
    expect(result).toEqual({ summary: '', suggestedHelpers: [], itinerary: [] });
  });

  it('should correctly parse valid JSON', () => {
    const raw = JSON.stringify({
      summary: 'A great trip',
      suggestedHelpers: [],
      itinerary: []
    });
    const result = parseTripSuggestion(raw);
    expect(result).toEqual({ summary: 'A great trip', suggestedHelpers: [], itinerary: [] });
  });
});
