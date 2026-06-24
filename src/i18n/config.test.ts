import { describe, it, expect, vi } from 'vitest';

vi.mock('i18next', () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockReturnThis(),
  }
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {}
}));

vi.mock('i18next-browser-languagedetector', () => ({
  default: {}
}));

import { isRTL } from './config';

describe('isRTL', () => {
  it('should return true for RTL locales', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('he')).toBe(true);
  });

  it('should return false for supported LTR locales', () => {
    expect(isRTL('en')).toBe(false);
    expect(isRTL('es')).toBe(false);
    expect(isRTL('fr')).toBe(false);
    expect(isRTL('de')).toBe(false);
    expect(isRTL('ja')).toBe(false);
  });

  it('should return false for unsupported locales', () => {
    expect(isRTL('ru')).toBe(false);
    expect(isRTL('zh')).toBe(false);
    expect(isRTL('')).toBe(false);
    expect(isRTL('xyz')).toBe(false);
  });
});
