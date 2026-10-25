import { createZapSchema } from '@zaps/shared';
import { Router } from 'express';
import { ZodError } from 'zod';
import { AppModel } from '../../../models/app.js';
import { ZapModel } from '../../../models/zap.js';
import { toZapDto } from '../../../zaps/index.js';

/** `400 VALIDATION_ERROR` on `appId`, in the same zod-issue shape as the body checks. */
function appIdError(message: string): ZodError {
  return new ZodError([{ code: 'custom', path: ['appId'], message }]);
}

/**
 * `POST /api/zaps`: validates the body with the shared zod schema, checks that `appId`
 * references an app whose `key` equals `trigger.app`, then saves the Zap disabled with no
 * webhook (API.md → Zaps).
 */
export const createZapRouter = Router();

createZapRouter.post('/', async (req, res) => {
  const input = createZapSchema.parse(req.body);

  const app = await AppModel.findById(input.appId).lean();
  if (!app) throw appIdError('Unknown app');
  if (app.key !== input.trigger.app) {
    throw appIdError(`App doesn't match the trigger app ${input.trigger.app}`);
  }

  const zap = await ZapModel.create({
    ...input,
    userId: req.user!._id,
    enabled: false,
    webhook: null,
  });
  res.status(201).json(toZapDto(zap));
});
