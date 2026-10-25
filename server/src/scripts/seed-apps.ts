import { APPS_SEED, type AppSeed } from '@zaps/shared';
import { AppModel } from '../models/app.js';

/**
 * Upserts the app catalog by `key` (Data-model.md → apps). Idempotent: running it again
 * updates the existing documents (and their `updatedAt`) instead of adding new ones.
 * Apps no longer in the seed list are left untouched.
 */
export async function seedApps(seed: readonly AppSeed[] = APPS_SEED): Promise<number> {
  if (seed.length === 0) return 0;
  await AppModel.bulkWrite(
    seed.map((app) => ({
      updateOne: { filter: { key: app.key }, update: { $set: { ...app } }, upsert: true },
    })),
  );
  return seed.length;
}
