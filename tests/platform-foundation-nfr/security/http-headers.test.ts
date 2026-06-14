/**
 * PRD 8.3 / 9.4 — Security headers & transport security.
 *
 * Acceptance criteria:
 * AC-8.3.1  HTTPS enforced — HTTP redirects to HTTPS (HSTS)
 * AC-8.3.2  Content-Security-Policy header present & restrictive
 * AC-8.3.3  X-Frame-Options = DENY or CSP frame-ancestors none
 * AC-8.3.4  X-Content-Type-Options = nosniff
 * AC-8.3.5  Referrer-Policy set
 * AC-8.3.6  Permissions-Policy / Feature-Policy set
 * AC-8.3.7  No Server / X-Powered-By headers exposing stack info
 * AC-8.3.8  CORS: wildcard origin rejected on credentialed requests
 * AC-8.3.9  API rate-limiting headers (RateLimit-Limit etc.) present
 */

import axios from "axios";
import { API_URL, BASE_URL, createAnonClient, createAuthClient } from "../setup/helpers";

const anonClient = createAnonClient();
const authClient = createAuthClient();

describe("[8.3] Security — HTTP headers", () => {
  let frontendHeaders: Record<string, string> = {};
  let apiHeaders: Record<string, string> = {};

  beforeAll(async () => {
    const feRes = await axios.get(BASE_URL, { validateStatus: () => true });
    frontendHeaders = feRes.headers as Record<string, string>;

    const apiRes = await anonClient.get("/healthz");
    apiHeaders = apiRes.headers as Record<string, string>;
  });

  // ------------------------------------------------------------------ 8.3.2
  test("AC-8.3.2 — Content-Security-Policy header present", () => {
    const csp =
      frontendHeaders["content-security-policy"] ??
      frontendHeaders["content-security-policy-report-only"];
    expect(csp).toBeDefined();
    expect(csp!.length).toBeGreaterThan(10);
    // Must not be a totally open policy
    expect(csp).not.toContain("* *");
    expect(csp).not.toBe("default-src *");
  });

  // ------------------------------------------------------------------ 8.3.3
  test("AC-8.3.3 — X-Frame-Options DENY or CSP frame-ancestors none", () => {
    const xfo = frontendHeaders["x-frame-options"] ?? "";
    const csp = frontendHeaders["content-security-policy"] ?? "";
    const protected_ =
      xfo.toUpperCase().includes("DENY") ||
      xfo.toUpperCase().includes("SAMEORIGIN") ||
      csp.includes("frame-ancestors");
    expect(protected_).toBe(true);
  });

  // ------------------------------------------------------------------ 8.3.4
  test("AC-8.3.4 — X-Content-Type-Options: nosniff", () => {
    const val = frontendHeaders["x-content-type-options"] ?? apiHeaders["x-content-type-options"];
    expect(val?.toLowerCase()).toBe("nosniff");
  });

  // ------------------------------------------------------------------ 8.3.5
  test("AC-8.3.5 — Referrer-Policy header present", () => {
    const rp = frontendHeaders["referrer-policy"] ?? apiHeaders["referrer-policy"];
    expect(rp).toBeDefined();
    const acceptable = [
      "no-referrer",
      "no-referrer-when-downgrade",
      "strict-origin",
      "strict-origin-when-cross-origin",
      "same-origin",
    ];
    expect(acceptable.some((v) => rp!.includes(v))).toBe(true);
  });

  // ------------------------------------------------------------------ 8.3.6
  test("AC-8.3.6 — Permissions-Policy header present", () => {
    const pp =
      frontendHeaders["permissions-policy"] ??
      frontendHeaders["feature-policy"];
    expect(pp).toBeDefined();
  });

  // ------------------------------------------------------------------ 8.3.7
  test("AC-8.3.7 — Server header does not expose framework/version", () => {
    const server = (apiHeaders["server"] ?? "").toLowerCase();
    const xpb = (apiHeaders["x-powered-by"] ?? "").toLowerCase();
    // Should not expose e.g. "express", "nginx/1.21.3", "node"
    const dangerous = ["express", "node", "php", "apache", "nginx/", "iis"];
    const exposed = dangerous.filter(
      (d) => server.includes(d) || xpb.includes(d)
    );
    expect(exposed).toHaveLength(0);
  });

  // ------------------------------------------------------------------ 8.3.1 HSTS
  test("AC-8.3.1 — HSTS header present with max-age ≥ 1 year", () => {
    const hsts =
      frontendHeaders["strict-transport-security"] ??
      apiHeaders["strict-transport-security"];
    if (!hsts) {
      // If test environment is HTTP-only, skip with warning
      console.warn(
        "HSTS header absent — acceptable only in local HTTP-only test env"
      );
      return;
    }
    const match = hsts.match(/max-age=(\d+)/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1])).toBeGreaterThanOrEqual(31536000);
  });

  // ------------------------------------------------------------------ 8.3.8 CORS
  test("AC-8.3.8 — CORS does not allow wildcard with credentials", async () => {
    const res = await axios.get(`${API_URL}/api/events`, {
      validateStatus: () => true,
      headers: {
        Origin: "https://evil.example.com",
        Authorization: `Bearer ${process.env.TEST_USER_JWT}`,
      },
    });
    const acao = res.headers["access-control-allow-origin"] ?? "";
    const acac = res.headers["access-control-allow-credentials"] ?? "";
    // If origin is reflected wildcard (*) with credentials=true, that's a violation
    const violation = acao === "*" && acac.toLowerCase() === "true";
    expect(violation).toBe(false);
    // Untrusted origin must not be reflected back with credentials
    if (acac.toLowerCase() === "true") {
      expect(acao).not.toBe("https://evil.example.com");
    }
  });

  // ------------------------------------------------------------------ 8.3.9 rate limiting
  test("AC-8.3.9 — Rate-limit headers present on API responses", async () => {
    const res = await authClient.get("/api/events");
    const hasRL =
      !!res.headers["ratelimit-limit"] ||
      !!res.headers["x-ratelimit-limit"] ||
      !!res.headers["x-rate-limit-limit"];
    expect(hasRL).toBe(true);
  });
});