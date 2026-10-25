import { randomBytes } from 'node:crypto';
import type { Octokit } from '@octokit/rest';
import { mapGithubError } from './errors.js';

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
 * GitHub errors are mapped with `mapGithubError` (E3); the 422 leftover-hook lookup is E4.
 */
export async function createWebhook(
  octokit: Octokit,
  { owner, repo, zapId, webhookPublicUrl }: CreateWebhookParams,
): Promise<{ hookId: number; secret: string }> {
  const secret = generateWebhookSecret();
  try {
    const { data } = await octokit.rest.repos.createWebhook({
      owner,
      repo,
      ...buildHookBody(zapId, secret, webhookPublicUrl),
    });
    return { hookId: data.id, secret };
  } catch (err) {
    throw mapGithubError(err, { repoAccess: true });
  }
}

export interface RemoveWebhookParams {
  owner: string;
  repo: string;
  hookId: number;
}

/** Deletes the Zap's webhook. Happy path only: best-effort and 404 rules are E5. */
export async function removeWebhook(
  octokit: Octokit,
  { owner, repo, hookId }: RemoveWebhookParams,
): Promise<void> {
  await octokit.rest.repos.deleteWebhook({ owner, repo, hook_id: hookId });
}
