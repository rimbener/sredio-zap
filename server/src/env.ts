import { z } from 'zod';

const nonEmpty = z.string().trim().min(1);

/** Strict base64 that decodes to exactly 32 bytes (AES-256-GCM key). */
const encryptionKey = nonEmpty.refine(
  (value) =>
    /^[A-Za-z0-9+/]+={0,2}$/.test(value) &&
    value.length % 4 === 0 &&
    Buffer.from(value, 'base64').length === 32,
  { message: 'must be base64 that decodes to 32 bytes' },
);

/** All vars from API.md → Configuration. */
export const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535),
  CLIENT_URL: z.string().url(),
  MONGODB_URI: nonEmpty.regex(/^mongodb(\+srv)?:\/\//, 'must be a mongodb:// URI'),
  SESSION_SECRET: nonEmpty,
  GITHUB_CLIENT_ID: nonEmpty,
  GITHUB_CLIENT_SECRET: nonEmpty,
  GITHUB_CALLBACK_URL: z.string().url(),
  WEBHOOK_PUBLIC_URL: z.string().url(),
  TOKEN_ENCRYPTION_KEY: encryptionKey,
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

/** Validates `source` (default `process.env`). Throws `EnvError` listing every bad var. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new EnvError(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated env, parsed from `process.env` once on first use. */
export function getEnv(): Env {
  cached ??= loadEnv();
  return cached;
}

/** The decoded 32-byte `TOKEN_ENCRYPTION_KEY`. */
export function getTokenEncryptionKey(env: Env = getEnv()): Buffer {
  return Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64');
}
