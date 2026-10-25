import { Router } from 'express';
import { encrypt } from '../../../crypto/token.js';
import { getEnv, getTokenEncryptionKey } from '../../../env.js';
import { octokitFor } from '../../../github/octokit.js';
import { createWebhook, removeWebhook } from '../../../github/webhooks.js';
import { findOwnedZap, toZapDto } from '../../../zaps/index.js';

type RepoConfig = { owner: string; repo: string };

/**
 * `POST /api/zaps/:id/enable` and `/disable` (API.md → Zaps → Enable, Disable).
 * Happy path only: GitHub error mapping (E3), the leftover-hook 409 (E4) and the
 * best-effort / no-op / `APP_UNAVAILABLE` rules (E5) come later.
 */
export const toggleZapRouter = Router();

toggleZapRouter.post('/:id/enable', async (req, res) => {
  const user = req.user!;
  const zap = await findOwnedZap(user._id, req.params.id);
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

  // A disabled Zap has no webhook, so there is nothing to remove on GitHub.
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
