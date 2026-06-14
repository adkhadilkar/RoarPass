import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: [
    "<rootDir>/architecture/**/*.test.ts",
    "<rootDir>/security/**/*.test.ts",
    "<rootDir>/privacy/**/*.test.ts",
    "<rootDir>/observability/**/*.test.ts",
  ],
  globalSetup: "<rootDir>/setup/global-setup.ts",
  globalTeardown: "<rootDir>/setup/global-teardown.ts",
  setupFilesAfterFramework: [],
  testTimeout: 30000,
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "./reports",
        outputName: "junit-platform-nfr.xml",
      },
    ],
  ],
  collectCoverageFrom: ["src/**/*.ts"],
};

export default config;