import { encrypt } from '../crypto/token.js';
import { getEnv, getTokenEncryptionKey } from '../env.js';
import { octokitFor } from '../github/octokit.js';
import { createWebhook, removeWebhook } from '../github/webhooks.js';
import type { UserDocument } from '../models/user.js';
import type { ZapDocument } from '../models/zap.js';

export type RepoConfig = { owner: string; repo: string };

/** GitHub names are case-insensitive, so `Acme/API` and `acme/api` are the same repo (API.md → Side effects). */
export function isSameRepo(a: RepoConfig, b: RepoConfig): boolean {
  return a.owner.toLowerCase() === b.owner.toLowerCase() && a.repo.toLowerCase() === b.repo.toLowerCase();
}

/**
 * Saves `changes` on an enabled Zap whose trigger repo changes, moving its webhook
 * (API.md → Side effects; Data-model.md → Lifecycle rules):
 * 1. create the new hook with the create-webhook routine; if that throws, nothing has changed;
 * 2. save the Zap with the changes and the new `webhook`; if that throws, the new hook is
 *    removed best-effort and the error propagates (`500`);
 * 3. remove the old hook best-effort (`removeWebhook` never throws).
 */
export async function saveWithMovedWebhook(
  user: UserDocument,
  zap: ZapDocument,
  changes: { trigger: { config: RepoConfig } } & Record<string, unknown>,
): Promise<void> {
  const key = getTokenEncryptionKey();
  const octokit = octokitFor(user.accessToken, key);
  const { owner: oldOwner, repo: oldRepo } = zap.trigger.config as RepoConfig;
  const oldHookId = zap.webhook?.hookId;
  const { owner, repo } = changes.trigger.config;

  const { hookId, secret } = await createWebhook(octokit, {
    owner,
    repo,
    zapId: zap._id.toString(),
    webhookPublicUrl: getEnv().WEBHOOK_PUBLIC_URL,
  });

  try {
    zap.set({ ...changes, webhook: { hookId, secret: encrypt(secret, key) } });
    await zap.save();
  } catch (err) {
    await removeWebhook(octokit, { owner, repo, hookId });
    throw err;
  }

  if (oldHookId !== undefined) {
    await removeWebhook(octokit, { owner: oldOwner, repo: oldRepo, hookId: oldHookId });
  }
}
