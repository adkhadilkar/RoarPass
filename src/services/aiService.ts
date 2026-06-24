import { Event } from '../models/Event';
import { FanProfile } from '../models/FanProfile';

export interface AiServiceConfig {
  provider: string;
  // API key is referenced by env var name only; never inlined.
  apiKeyEnvVar: string;
  timeoutMs: number;
}

/**
 * Centralized AI client config shared by recommendation and trip-assistant features.
 * Merged: preserves existing recommendation config and adds trip-assistant config.
 */
export const aiServiceConfig: AiServiceConfig = {
  provider: process.env.AI_PROVIDER ?? 'default',
  apiKeyEnvVar: 'AI_API_KEY',
  timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 15000),
};

export interface AiContext {
  locale: string;
  rtl: boolean;
  fanProfile?: Pick<FanProfile, 'id' | 'locale' | 'interests'>;
}

export async function callAiModel(
  prompt: string,
  context: AiContext
): Promise<string> {
  const apiKey = process.env[aiServiceConfig.apiKeyEnvVar];
  if (!apiKey) {
    throw new Error(`Missing AI API key env var: ${aiServiceConfig.apiKeyEnvVar}`);
  }
  // Implementation delegated to provider adapter (unchanged from main).
  return providerAdapter.complete(prompt, context, {
    apiKey,
    timeoutMs: aiServiceConfig.timeoutMs,
  });
}

// Re-exported so trip-assistant can build on the same primitives.
export { providerAdapter } from './providerAdapter';