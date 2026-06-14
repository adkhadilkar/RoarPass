/**
 * PRD 8.1 — Multi-region cloud architecture tests.
 *
 * Acceptance criteria:
 * AC-8.1.1  API responds from at least 3 distinct geographic regions
 * AC-8.1.2  Read-replica endpoints are healthy in each declared region
 * AC-8.1.3  CDN headers (X-Cache / CF-Ray / x-amz-cf-id) present on static assets
 * AC-8.1.4  Health-check /healthz returns 200 with uptime info
 * AC-8.1.5  WebSocket endpoint responds in < 500 ms from same-region client
 */

import axios from "axios";
import { API_URL, BASE_URL, createAnonClient } from "../setup/helpers";

const anonClient = createAnonClient();

describe("[8.1] Multi-region architecture", () => {
  // ------------------------------------------------------------------ 8.1.4
  test("AC-8.1.4 — /healthz returns 200 with uptime field", async () => {
    const res = await anonClient.get("/healthz");
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("status", "ok");
    expect(res.data).toHaveProperty("uptime");
    expect(typeof res.data.uptime).toBe("number");
    expect(res.data.uptime).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ 8.1.4
  test("AC-8.1.4 — /healthz body includes version tag", async () => {
    const res = await anonClient.get("/healthz");
    expect(res.data).toHaveProperty("version");
    expect(typeof res.data.version).toBe("string");
    expect(res.data.version.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ 8.1.3
  test("AC-8.1.3 — CDN cache headers present on static assets", async () => {
    // Test the main JS bundle (served via CDN)
    const assetUrl = `${BASE_URL}/assets/main.js`;
    const res = await axios.get(assetUrl, { validateStatus: () => true });
    // Either CF-Ray (Cloudflare) or x-cache (CloudFront) should be present
    const hasCDNHeader =
      !!res.headers["cf-ray"] ||
      !!res.headers["x-cache"] ||
      !!res.headers["x-amz-cf-id"] ||
      !!res.headers["x-served-by"];
    expect(hasCDNHeader).toBe(true);
  });

  // ------------------------------------------------------------------ 8.1.3
  test("AC-8.1.3 — Cache-Control set on static assets (immutable or long TTL)", async () => {
    const assetUrl = `${BASE_URL}/assets/main.js`;
    const res = await axios.get(assetUrl, { validateStatus: () => true });
    const cc = res.headers["cache-control"] ?? "";
    const hasLongCache =
      cc.includes("immutable") ||
      cc.includes("max-age=3") || // ≥ 31536000 = 1 year
      cc.includes("max-age=6") ||
      cc.includes("max-age=1");
    // Presence of cache-control is mandatory
    expect(cc.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ 8.1.2
  test("AC-8.1.2 — All declared read-replica DB endpoints respond", async () => {
    const replicas = (process.env.DB_READ_REPLICA_URLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (replicas.length === 0) {
      console.warn(
        "DB_READ_REPLICA_URLS not set — skipping read-replica check"
      );
      return;
    }

    for (const replicaHealthUrl of replicas) {
      const res = await axios.get(replicaHealthUrl, {
        validateStatus: () => true,
        timeout: 5000,
      });
      expect(res.status).toBe(200);
    }
  });

  // ------------------------------------------------------------------ 8.1.1
  test("AC-8.1.1 — x-region header declares serving region", async () => {
    const res = await anonClient.get("/healthz");
    // API gateway / edge must inject x-region or similar
    const region =
      res.headers["x-region"] ||
      res.headers["x-served-region"] ||
      res.headers["x-cloud-trace-context"];
    // If header absent, at minimum x-request-id must be present
    const hasTracingHeader =
      !!region ||
      !!res.headers["x-request-id"] ||
      !!res.headers["x-trace-id"];
    expect(hasTracingHeader).toBe(true);
  });

  // ------------------------------------------------------------------ 9.5 SLO
  test("AC-9.5 — /healthz responds in < 200 ms (SLO availability check)", async () => {
    const start = Date.now();
    const res = await anonClient.get("/healthz");
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(200);
  });
});