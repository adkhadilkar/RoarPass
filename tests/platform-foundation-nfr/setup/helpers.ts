import axios, { AxiosInstance, AxiosResponse } from "axios";

export const API_URL =
  process.env.ROARPASS_API_URL ?? "http://localhost:4000";
export const BASE_URL =
  process.env.ROARPASS_BASE_URL ?? "http://localhost:3000";

/** Creates an axios client authenticated as a test user. */
export function createAuthClient(jwtEnvVar = "TEST_USER_JWT"): AxiosInstance {
  const token = process.env[jwtEnvVar];
  if (!token) throw new Error(`Env var ${jwtEnvVar} not set`);
  return axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true, // let tests assert status codes
  });
}

/** Creates an anonymous (unauthenticated) axios client. */
export function createAnonClient(): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    validateStatus: () => true,
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Measures the median latency of N sequential requests. */
export async function measureMedianLatency(
  fn: () => Promise<AxiosResponse>,
  samples = 10
): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = Date.now();
    await fn();
    times.push(Date.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}