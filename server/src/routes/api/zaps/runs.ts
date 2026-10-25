import type { ZapRunDto } from '@zaps/shared';
import { Router } from 'express';
import type { Types } from 'mongoose';
import { ZapRunModel, type ZapRun } from '../../../models/zapRun.js';
import { findOwnedZap } from '../../../zaps/index.js';

/** Runs returned per request (API.md → Conventions: "Runs return the latest 50"). */
export const ZAP_RUNS_LIMIT = 50;

/** Maps a `zapRuns` document to `ZapRunDto`: exposes `id`, never `zapId`, `userId` or `deliveryId`. */
export function toZapRunDto(
  run: ZapRun & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date },
): ZapRunDto {
  return {
    id: run._id.toString(),
    status: run.status,
    input: { prNumber: run.input.prNumber, prUrl: run.input.prUrl },
    output: run.output ? { commentUrl: run.output.commentUrl } : null,
    error: run.error ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

/** `GET /api/zaps/:id/runs`: the owner's latest 50 runs of a Zap, newest first. */
export const zapRunsRouter = Router();

zapRunsRouter.get('/:id/runs', async (req, res) => {
  const zap = await findOwnedZap(req.user!._id, req.params.id);
  const runs = await ZapRunModel.find({ zapId: zap._id, userId: zap.userId })
    // `_id` breaks ties between runs created in the same millisecond.
    .sort({ createdAt: -1, _id: -1 })
    .limit(ZAP_RUNS_LIMIT)
    .lean();
  res.json(runs.map(toZapRunDto));
});
