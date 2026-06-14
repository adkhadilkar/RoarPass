import { describe, it, expect } from "vitest";
import { isRTL, RTL_LANGUAGES, SUPPORTED_LANGUAGES, LocaleSchema } from "./foundation";

describe("isRTL", () => {
  it.each(RTL_LANGUAGES)("returns true for %s", (lang) => {
    expect(isRTL(lang)).toBe(true);
  });

  it("returns false for LTR languages", () => {
    expect(isRTL("en")).toBe(false);
    expect(isRTL("fr")).toBe(false);
    expect(isRTL("ko")).toBe(false);
    expect(isRTL("ja")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isRTL("")).toBe(false);
  });
});

describe("SUPPORTED_LANGUAGES", () => {
  it("contains at least 20 languages (PRD §8.6)", () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(20);
  });

  it("includes RTL languages", () => {
    for (const lang of RTL_LANGUAGES) {
      expect(SUPPORTED_LANGUAGES).toContain(lang);
    }
  });
});

describe("LocaleSchema", () => {
  it("parses a valid locale", () => {
    expect(LocaleSchema.parse("en")).toBe("en");
    expect(LocaleSchema.parse("ar")).toBe("ar");
  });

  it("rejects an unknown locale", () => {
    expect(() => LocaleSchema.parse("zz")).toThrow();
  });
});