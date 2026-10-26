import { randomBytes } from 'node:crypto';
import type { Env } from '../env.js';

/** A valid env for tests. `MONGODB_URI` is never used: tests connect to mongodb-memory-server. */
export const TEST_ENV = {
  NODE_ENV: 'test',
  PORT: '3000',
  CLIENT_URL: 'http://localhost:4200',
  MONGODB_URI: 'mongodb://127.0.0.1:1/unused-in-tests',
  SESSION_SECRET: 'test-session-secret-at-least-32-chars',
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_CALLBACK_URL: 'http://localhost:3000/auth/github/callback',
  WEBHOOK_PUBLIC_URL: 'https://smee.io/test-channel',
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
} satisfies Record<keyof Env, string>;

/**
 * Puts `TEST_ENV` into `process.env` so `getEnv()` works in tests. Tests never import
 * `dotenv/config`, so `server/.env` is never read.
 */
export function applyTestEnv(): void {
  Object.assign(process.env, TEST_ENV);
}
