import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { getEnv } from "./env";

/**
 * Fetches a secret value from AWS Secrets Manager by ARN.
 * Caches in memory for the process lifetime.
 * NEVER logs the returned value.
 */

const _secretCache: Map<string, string> = new Map();
const _client = new SecretsManagerClient({ region: getOptionalRegion() });

function getOptionalRegion(): string {
  return process.env["AWS_REGION"] ?? "us-east-1";
}

export async function getSecret(secretArn: string): Promise<string> {
  const cached = _secretCache.get(secretArn);
  if (cached) return cached;

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await _client.send(command);

  const value = response.SecretString;
  if (!value) throw new Error(`[secrets] Secret not found or empty: ${secretArn}`);

  _secretCache.set(secretArn, value);
  return value;
}

/** Retrieves the DeepL API key at runtime (never at build time). */
export async function getDeepLApiKey(): Promise<string> {
  return getSecret(getEnv("DEEPL_API_KEY_SECRET_ARN"));
}

/** Retrieves the AI Gateway API key at runtime. */
export async function getAIGatewayApiKey(): Promise<string> {
  return getSecret(getEnv("AI_GATEWAY_API_KEY_SECRET_ARN"));
}

/** Retrieves the internal service mesh shared secret. */
export async function getInternalServiceSecret(): Promise<string> {
  return getSecret(getEnv("INTERNAL_SERVICE_SECRET_ARN"));
}