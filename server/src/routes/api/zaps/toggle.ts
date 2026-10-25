import { Router } from 'express';
import { encrypt } from '../../../crypto/token.js';
import { getEnv, getTokenEncryptionKey } from '../../../env.js';
import { AppError } from '../../../errors/app-error.js';
import { octokitFor } from '../../../github/octokit.js';
import { createWebhook, removeWebhook } from '../../../github/webhooks.js';
import { AppModel } from '../../../models/app.js';
import { findOwnedZap, toZapDto } from '../../../zaps/index.js';

type RepoConfig = { owner: string; repo: string };

/**
 * `POST /api/zaps/:id/enable` and `/disable` (API.md → Zaps → Enable, Disable).
 * Enable/disable on a Zap already in that state is a no-op `200` with no GitHub call; enabling a
 * Zap whose app is `coming_soon` is `422 APP_UNAVAILABLE`; disable removes the hook best-effort.
 */
export const toggleZapRouter = Router();

toggleZapRouter.post('/:id/enable', async (req, res) => {
  const user = req.user!;
  const zap = await findOwnedZap(user._id, req.params.id);
  if (zap.enabled) {
    res.json(toZapDto(zap));
    return;
  }

  // `appId` is validated on create/update, so a missing app only happens if the catalog changed;
  // only a stored `coming_soon` status blocks enabling.
  const app = await AppModel.findById(zap.appId, { status: 1 }).lean();
  if (app && app.status !== 'available') {
    throw new AppError(422, 'APP_UNAVAILABLE', "This app isn't available yet");
  }

  const key = getTokenEncryptionKey();
  const { owner, repo } = zap.trigger.config as RepoConfig;

  const { hookId, secret } = await createWebhook(octokitFor(user.accessToken, key), {
    owner,
    repo,
    zapId: zap._id.toString(),
    webhookPublicUrl: getEnv().WEBHOOK_PUBLIC_URL,
  });

  zap.set({ enabled: true, webhook: { hookId, secret: encrypt(secret, key) } });
  await zap.save();
  res.json(toZapDto(zap));
});

toggleZapRouter.post('/:id/disable', async (req, res) => {
  const user = req.user!;
  const zap = await findOwnedZap(user._id, req.params.id);
  if (!zap.enabled) {
    res.json(toZapDto(zap));
    return;
  }

  // Best-effort: `removeWebhook` never throws, so local state wins even if GitHub fails.
  if (zap.webhook) {
    const { owner, repo } = zap.trigger.config as RepoConfig;
    await removeWebhook(octokitFor(user.accessToken, getTokenEncryptionKey()), {
      owner,
      repo,
      hookId: zap.webhook.hookId,
    });
  }

  zap.set({ enabled: false, webhook: null });
  await zap.save();
  res.json(toZapDto(zap));
});
