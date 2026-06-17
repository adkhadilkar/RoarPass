import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// First, we mock the module that causes issues
vi.mock('./providerAdapter', () => ({
  providerAdapter: {
    complete: vi.fn(),
  },
}));

// Now import the module we want to test
import { callAiModel, aiServiceConfig, AiContext } from './aiService';

describe('aiService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('callAiModel', () => {
    it('throws an error if the AI API key is missing', async () => {
      // Setup the environment to be missing the API key
      delete process.env[aiServiceConfig.apiKeyEnvVar];

      const context: AiContext = { locale: 'en-US', rtl: false };

      await expect(callAiModel('Test prompt', context)).rejects.toThrow(
        `Missing AI API key env var: ${aiServiceConfig.apiKeyEnvVar}`
      );
    });
  });
});
