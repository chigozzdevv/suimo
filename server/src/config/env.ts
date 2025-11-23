import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  MONGODB_URI: z.string().url().optional(),
  JWT_SECRET: z.string().min(16).optional(),
  ED25519_PRIVATE_KEY_PATH: z.string().optional(),
  KEY_ENCRYPTION_KEY: z.string().min(16).optional(),
  SUI_RPC_URL: z.string().url().optional(),
  SUI_PLATFORM_PRIVATE_KEY: z.string().optional(),
  SUI_USDC_TYPE: z.string().optional(),
  SUI_USDC_DECIMALS: z.string().optional(),
  WAL_COIN_TYPE: z.string().optional(),
  WAL_DECIMALS: z.string().optional(),
  WAL_USD_RATE: z.string().optional(),
  SUI_USD_RATE: z.string().optional(),
  SUI_PAYTO: z.string().optional(),
  WALRUS_NETWORK: z.string().optional(),
  WALRUS_RELAY_URL: z.string().optional(),
  WALRUS_UPLOAD_TIMEOUT_MS: z.string().optional(),
  WALRUS_CONNECT_TIMEOUT_MS: z.string().optional(),
  WALRUS_CONCURRENCY: z.string().optional(),
  WALRUS_MAX_RETRIES: z.string().optional(),
  SEAL_POLICY_PACKAGE: z.string().optional(),
  SEAL_KEY_SERVER_IDS: z.string().optional(),
  SEAL_SERVICE_URL: z.string().optional(),
  PLATFORM_FEE_BPS: z.string().optional(),
  OAUTH_ISSUER: z.string().url().optional(),
  OAUTH_RESOURCE: z.string().url().optional(),
  OAUTH_ACCESS_TOKEN_TTL: z.string().optional(),
  OAUTH_REFRESH_TOKEN_TTL: z.string().optional(),
  CLIENT_APP_URL: z.string().url().optional(),
  CLIENT_AUTH_PATH: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().optional(),
  SESSION_COOKIE_DOMAIN: z.string().optional(),
  SESSION_COOKIE_SECURE: z.string().optional(),
  SESSION_COOKIE_MAX_AGE: z.string().optional(),
  // Keep-alive service
  SERVER_URL: z.string().url().optional(),
  ENABLE_KEEPALIVE: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(parsed.error.toString());
  }
  cached = parsed.data;
  return cached;
}
