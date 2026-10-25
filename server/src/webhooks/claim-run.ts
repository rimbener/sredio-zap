import type { PullRequestPayload } from '@zaps/shared';
import type { ZapDocument } from '../models/zap.js';
import { ZapRunModel, type ZapRunDocument } from '../models/zapRun.js';

const DUPLICATE_KEY = 11000;

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === DUPLICATE_KEY;
}

/**
 * Claims a delivery before the comment is posted (Data-model.md → zapRuns, Deduplication).
 * Inserts a `pending` run; the unique index on `deliveryId` lets exactly one insert win.
 * On a duplicate key, atomically moves a `failed` run back to `pending` (a retry through
 * GitHub's "Redeliver"). Returns the claimed run, or `null` when the delivery is skipped
 * because its run is `success` or `pending` (a stuck `pending` run is never retried).
 */
export async function claimRun(
  zap: ZapDocument,
  deliveryId: string,
  payload: PullRequestPayload,
): Promise<ZapRunDocument | null> {
  const { pull_request: pr } = payload;
  try {
    return await ZapRunModel.create({
      zapId: zap._id,
      userId: zap.userId,
      deliveryId,
      status: 'pending',
      input: { prNumber: pr.number, prUrl: pr.html_url },
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
  }
  return ZapRunModel.findOneAndUpdate(
    { deliveryId, status: 'failed' },
    { status: 'pending', error: null },
    { new: true },
  );
}
