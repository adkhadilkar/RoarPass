import * as dotenv from "dotenv";
dotenv.config();

/**
 * Global setup: validate required env vars, warm DB connections.
 * Runs once before all Jest tests.
 */
async function globalSetup(): Promise<void> {
  const required = [
    "ROARPASS_BASE_URL",
    "ROARPASS_API_URL",
    "TEST_USER_JWT",
    "ADMIN_JWT",
  ];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length) {
    throw new Error(
      `[global-setup] Missing required env vars: ${missing.join(", ")}`
    );
  }
  console.log(
    `[global-setup] Target: ${process.env.ROARPASS_BASE_URL} / ${process.env.ROARPASS_API_URL}`
  );
}

export default globalSetup;