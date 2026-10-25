import { listZapsQuerySchema } from '@zaps/shared';
import { Router } from 'express';
import { ZapModel } from '../../../models/zap.js';
import { toZapDto } from '../../../zaps/index.js';

/** `GET /api/zaps?appId=`: the session user's Zaps, newest `updatedAt` first (API.md → Zaps). */
export const listZapsRouter = Router();

listZapsRouter.get('/', async (req, res) => {
  const { appId } = listZapsQuerySchema.parse(req.query);
  const userId = req.user!._id;
  const filter = appId ? { userId, appId } : { userId };
  const zaps = await ZapModel.find(filter).sort({ updatedAt: -1 }).lean();
  res.json(zaps.map(toZapDto));
});
