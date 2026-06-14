import { describe, it, expect } from "vitest";
import {
  stripHtml,
  truncate,
  isUUID,
  isISO639,
  isSafePath,
  pseudonymizeForThirdParty,
} from "./sanitize";

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<script>alert('xss')</script>Hello")).toBe("Hello");
    expect(stripHtml("<b>Bold</b>")).toBe("Bold");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("Hello world")).toBe("Hello world");
  });
});

describe("truncate", () => {
  it("truncates strings longer than maxLength", () => {
    expect(truncate("abcde", 3)).toBe("abc");
  });

  it("returns unchanged string when within limit", () => {
    expect(truncate("abc", 5)).toBe("abc");
  });
});

describe("isUUID", () => {
  it("accepts a valid UUID v4", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(false); // v1-style
    expect(isUUID("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("rejects invalid strings", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
    expect(isUUID("")).toBe(false);
  });
});

describe("isISO639", () => {
  it("accepts valid codes", () => {
    expect(isISO639("en")).toBe(true);
    expect(isISO639("ar")).toBe(true);
    expect(isISO639("zh-CN")).toBe(true);
  });

  it("rejects invalid codes", () => {
    expect(isISO639("english")).toBe(false);
    expect(isISO639("")).toBe(false);
  });
});

describe("isSafePath", () => {
  it("rejects path traversal", () => {
    expect(isSafePath("../../etc/passwd")).toBe(false);
    expect(isSafePath("%2e%2e/secret")).toBe(false);
  });

  it("accepts safe paths", () => {
    expect(isSafePath("uploads/image.png")).toBe(true);
  });
});

describe("pseudonymizeForThirdParty", () => {
  it("removes UUIDs", () => {
    const input = "User f47ac10b-58cc-4372-a567-0e02b2c3d479 said hello";
    expect(pseudonymizeForThirdParty(input)).toContain("[ID]");
    expect(pseudonymizeForThirdParty(input)).not.toContain(
      "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    );
  });

  it("removes email addresses", () => {
    const input = "Contact me at john@example.com please";
    expect(pseudonymizeForThirdParty(input)).toContain("[EMAIL]");
  });
});