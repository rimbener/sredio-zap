import { after, before, beforeEach } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../db.js';
import { applyTestEnv } from './env.js';

applyTestEnv();

/** Deletes every document in every collection (models and the `sessions` store). */
export async function clearDatabase(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

/**
 * Call once at the top of a test file. Starts an in-memory MongoDB for the file, connects
 * the shared Mongoose connection to it (so `createApp()`'s session store uses it too),
 * clears all collections before each test and stops the server after the file.
 */
export function useTestDb(): void {
  let mongod: MongoMemoryServer | undefined;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await connectDb(mongod.getUri());
    // Build declared indexes (e.g. unique `githubId`) before tests rely on them.
    await mongoose.connection.syncIndexes();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  after(async () => {
    await disconnectDb();
    await mongod?.stop();
  });
}
