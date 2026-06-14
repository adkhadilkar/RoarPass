import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
dotenv.config();

export default defineConfig({
  testDir: "./accessibility",
  timeout: 60_000,
  retries: 1,
  workers: 2,
  reporter: [
    ["html", { outputFolder: "reports/playwright-html" }],
    ["junit", { outputFile: "reports/junit-accessibility.xml" }],
  ],
  use: {
    baseURL: process.env.ROARPASS_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-a11y",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /.*\.a11y\.ts/,
    },
    {
      name: "firefox-i18n",
      use: { ...devices["Desktop Firefox"] },
      testMatch: /.*\.i18n\.ts/,
    },
    {
      name: "mobile-rtl",
      use: { ...devices["Pixel 5"] },
      testMatch: /.*\.rtl\.ts/,
    },
  ],
});