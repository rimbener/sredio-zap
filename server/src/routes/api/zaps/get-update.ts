import { patchZapSchema, validateZap } from '@zaps/shared';
import { Router } from 'express';
import { ZodError } from 'zod';
import { AppModel } from '../../../models/app.js';
import { findOwnedZap, toZapDto } from '../../../zaps/index.js';

/** `400 VALIDATION_ERROR` on `appId`, in the same zod-issue shape as the body checks. */
function appIdError(message: string): ZodError {
  return new ZodError([{ code: 'custom', path: ['appId'], message }]);
}

/**
 * `GET /api/zaps/:id` and `PATCH /api/zaps/:id` (API.md → Zaps). PATCH merges the body
 * into the stored Zap at the top level (a sent step replaces the whole step), validates the
 * merged Zap with the shared schema and checks `appId` ↔ `trigger.app`.
 */
export const getUpdateZapRouter = Router();

getUpdateZapRouter.get('/:id', async (req, res) => {
  const zap = await findOwnedZap(req.user!._id, req.params.id);
  res.json(toZapDto(zap));
});

getUpdateZapRouter.patch('/:id', async (req, res) => {
  const patch = patchZapSchema.parse(req.body);
  const zap = await findOwnedZap(req.user!._id, req.params.id);

  const current = toZapDto(zap);
  const merged = validateZap({
    appId: patch.appId ?? current.appId,
    name: patch.name ?? current.name,
    trigger: patch.trigger ?? current.trigger,
    action: patch.action ?? current.action,
  });

  const app = await AppModel.findById(merged.appId).lean();
  if (!app) throw appIdError('Unknown app');
  if (app.key !== merged.trigger.app) {
    throw appIdError(`App doesn't match the trigger app ${merged.trigger.app}`);
  }

  // A repo change on an enabled Zap moves its webhook; that's E6. Until then this saves the
  // Zap as-is, so don't change the repo of an enabled Zap (Tasks.md → Spec gaps, 10).
  zap.set({ appId: merged.appId, name: merged.name, trigger: merged.trigger, action: merged.action });
  await zap.save();
  res.json(toZapDto(zap));
});
