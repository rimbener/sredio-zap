import { objectIdSchema } from '@zaps/shared';
import type { Types } from 'mongoose';
import { NotFoundError } from '../errors/app-error.js';
import { ZapModel, type ZapDocument } from '../models/zap.js';

/**
 * Loads a Zap owned by `userId`. An invalid ObjectId, a missing Zap and another user's Zap
 * all throw `404 NOT_FOUND`, so a Zap's existence is never revealed (Data-model.md → Ownership).
 */
export async function findOwnedZap(
  userId: Types.ObjectId | string,
  id: string,
): Promise<ZapDocument> {
  if (!objectIdSchema.safeParse(id).success) throw new NotFoundError('Zap not found');
  const zap = await ZapModel.findOne({ _id: id, userId });
  if (!zap) throw new NotFoundError('Zap not found');
  return zap;
}
