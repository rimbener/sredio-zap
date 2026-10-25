import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';

/** Session store lifetime; matches the cookie `maxAge` (Data-model.md → sessions). */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

let connection: Promise<typeof mongoose> | undefined;

/**
 * Calls `mongoose.connect()` exactly once and returns the shared promise.
 * Startup awaits it before `listen`; the session store reuses it.
 */
export function connectDb(uri: string): Promise<typeof mongoose> {
  connection ??= mongoose.connect(uri);
  return connection;
}

/** The shared connection promise. Throws if `connectDb()` hasn't been called. */
export function getConnection(): Promise<typeof mongoose> {
  if (!connection) {
    throw new Error('connectDb() must be called before using the database');
  }
  return connection;
}

/** Closes the connection and forgets the shared promise (tests, shutdown). */
export async function disconnectDb(): Promise<void> {
  connection = undefined;
  await mongoose.disconnect();
}

/** connect-mongo v5 store on Mongoose's client (`getClient()` is valid once `connect()` resolves). */
export function createSessionStore(conn: Promise<typeof mongoose> = getConnection()): MongoStore {
  // connect-mongo may resolve its own copy of the `mongodb` peer; the store only uses the
  // client passed in, so the cast only bridges the two type declarations.
  type StoreClient = Awaited<NonNullable<Parameters<typeof MongoStore.create>[0]['clientPromise']>>;
  return MongoStore.create({
    clientPromise: conn.then((m) => m.connection.getClient() as unknown as StoreClient),
    ttl: SESSION_TTL_SECONDS,
  });
}
