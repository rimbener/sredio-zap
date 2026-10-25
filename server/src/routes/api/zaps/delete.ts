import { Router } from 'express';
import { getTokenEncryptionKey } from '../../../env.js';
import { octokitFor } from '../../../github/octokit.js';
import { removeWebhook } from '../../../github/webhooks.js';
import { ZapModel } from '../../../models/zap.js';
import { ZapRunModel } from '../../../models/zapRun.js';
import { findOwnedZap } from '../../../zaps/index.js';

/**
 * `DELETE /api/zaps/:id`: removes the Zap's webhook on GitHub if it has one, then deletes the
 * Zap and its `zapRuns` → `204` (API.md → Zaps; Data-model.md → Lifecycle rules).
 * Happy path only: best-effort removal when GitHub fails is E5.
 */
export const deleteZapRouter = Router();

deleteZapRouter.delete('/:id', async (req, res) => {
  const user = req.user!;
  const zap = await findOwnedZap(user._id, req.params.id);

  if (zap.webhook) {
    const { owner, repo } = zap.trigger.config as { owner: string; repo: string };
    await removeWebhook(octokitFor(user.accessToken, getTokenEncryptionKey()), {
      owner,
      repo,
      hookId: zap.webhook.hookId,
    });
  }

  // Zap first: if the runs delete fails, the leftovers expire through the zapRuns TTL index.
  await ZapModel.deleteOne({ _id: zap._id });
  await ZapRunModel.deleteMany({ zapId: zap._id });
  res.status(204).end();
});
