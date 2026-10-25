// Must stay the first import: loads server/.env (quiet; never overrides vars already set).
import 'dotenv/config';
import { createApp } from './app.js';
import { connectDb, createSessionStore } from './db.js';
import { loadEnv } from './env.js';

/** Validates env (throws on a missing/invalid var), connects Mongo, then listens. */
async function start(): Promise<void> {
  const env = loadEnv();
  const conn = connectDb(env.MONGODB_URI);
  await conn;

  const app = createApp({ env, sessionStore: createSessionStore(conn) });
  app.listen(env.PORT, () => {
    console.log(`Zaps API listening on http://localhost:${env.PORT}`);
  });
}

start().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
