import { randomBytes } from 'node:crypto';
import type { Octokit } from '@octokit/rest';
import { mapGithubError } from './errors.js';
import { leftoverHookError } from './find-own-hook.js';

export interface HookBody {
  active: true;
  events: ['pull_request'];
  config: {
    url: string;
    content_type: 'json';
    secret: string;
    insecure_ssl: '0';
  };
}

const SECRET_BYTES = 32;

/** The hook body from API.md → Create-webhook routine. `?zap=<id>` makes each Zap's hook URL unique. */
export function buildHookBody(zapId: string, secret: string, webhookPublicUrl: string): HookBody {
  return {
    active: true,
    events: ['pull_request'],
    config: {
      url: `${webhookPublicUrl}?zap=${zapId}`,
      content_type: 'json',
      secret,
      insecure_ssl: '0',
    },
  };
}

/** A fresh random 32-byte webhook secret, hex-encoded (64 chars). */
export function generateWebhookSecret(): string {
  return randomBytes(SECRET_BYTES).toString('hex');
}

export interface CreateWebhookParams {
  owner: string;
  repo: string;
  zapId: string;
  /** `WEBHOOK_PUBLIC_URL`; passed in until F3's `env.ts` lands. */
  webhookPublicUrl: string;
}

/**
 * Creates the Zap's webhook and returns its id and the plain secret (the caller encrypts it before storing).
 * GitHub errors are mapped with `mapGithubError` (E3); a 422 first goes through the leftover-hook lookup (E4).
 */
export async function createWebhook(
  octokit: Octokit,
  { owner, repo, zapId, webhookPublicUrl }: CreateWebhookParams,
): Promise<{ hookId: number; secret: string }> {
  const secret = generateWebhookSecret();
  const body = buildHookBody(zapId, secret, webhookPublicUrl);
  try {
    const { data } = await octokit.rest.repos.createWebhook({ owner, repo, ...body });
    return { hookId: data.id, secret };
  } catch (err) {
    // GitHub 422: maybe this Zap's own leftover hook (E4) → 409 WEBHOOK_EXISTS, else 502.
    if ((err as { status?: unknown }).status === 422) {
      throw await leftoverHookError(octokit, { owner, repo, url: body.config.url });
    }
    throw mapGithubError(err, { repoAccess: true });
  }
}

export interface RemoveWebhookParams {
  owner: string;
  repo: string;
  hookId: number;
}

/**
 * Deletes the Zap's webhook, best-effort (API.md → Disable / Delete): it never throws.
 * A GitHub `404` means the hook is already gone. Any other failure, `401` included, is swallowed
 * without ending the session, so local state wins and the caller always disables/deletes the Zap.
 * A hook left behind triggers nothing (its deliveries match no Zap).
 */
export async function removeWebhook(
  octokit: Octokit,
  { owner, repo, hookId }: RemoveWebhookParams,
): Promise<void> {
  try {
    await octokit.rest.repos.deleteWebhook({ owner, repo, hook_id: hookId });
  } catch {
    // 404: already removed. Anything else: leftover hook, ignored by design.
  }
}
