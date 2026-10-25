// `npm run seed -w server`: upserts the app catalog from `/shared` into MongoDB.
import 'dotenv/config';
import { connectDb, disconnectDb } from '../db.js';
import { getEnv } from '../env.js';
import { seedApps } from './seed-apps.js';

const env = getEnv();
try {
  await connectDb(env.MONGODB_URI);
  const count = await seedApps();
  console.log(`Seeded ${count} apps`);
} finally {
  await disconnectDb();
}
