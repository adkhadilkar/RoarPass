import { describe, it, expect } from "vitest";
import { sha256, generateSecureToken, safeEqual, hashIp } from "./crypto";

describe("sha256", () => {
  it("produces a 64-char hex string", () => {
    expect(sha256("hello")).toHaveLength(64);
  });

  it("is deterministic", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });

  it("differs for different inputs", () => {
    expect(sha256("hello")).not.toBe(sha256("world"));
  });
});

describe("generateSecureToken", () => {
  it("produces a hex string of correct length", () => {
    expect(generateSecureToken(32)).toHaveLength(64);
    expect(generateSecureToken(16)).toHaveLength(32);
  });

  it("produces unique tokens", () => {
    expect(generateSecureToken()).not.toBe(generateSecureToken());
  });
});

describe("safeEqual", () => {
  it("returns true for equal strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("hashIp", () => {
  it("returns a deterministic hash", () => {
    expect(hashIp("192.168.1.1", "salt123")).toBe(
      hashIp("192.168.1.1", "salt123")
    );
  });

  it("differs for different salts", () => {
    expect(hashIp("192.168.1.1", "salt1")).not.toBe(
      hashIp("192.168.1.1", "salt2")
    );
  });
});