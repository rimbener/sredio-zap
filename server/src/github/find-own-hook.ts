import type { Octokit } from '@octokit/rest';
import { AppError } from '../errors/app-error.js';
import { GithubError } from './errors.js';

export interface FindOwnHookParams {
  owner: string;
  repo: string;
  /** This Zap's hook URL (`buildHookBody(...).config.url`). It contains the Zap id. */
  url: string;
}

/**
 * Looks through every page of the repo's hooks (`per_page=100`) for one whose `config.url`
 * is this Zap's URL, and returns its id, or `null` when there's none (API.md → Create-webhook
 * routine, step 2). List failures are thrown as they come.
 */
export async function findOwnHook(octokit: Octokit, { owner, repo, url }: FindOwnHookParams): Promise<number | null> {
  const pages = octokit.paginate.iterator(octokit.rest.repos.listWebhooks, { owner, repo, per_page: 100 });
  for await (const { data } of pages) {
    const hook = data.find((h) => h.config.url === url);
    if (hook) return hook.id;
  }
  return null;
}

/**
 * The error for a GitHub `422` on create (API.md → Create-webhook routine, steps 2–4):
 * this Zap's leftover hook found → `409 WEBHOOK_EXISTS` with a link to it (the hook is left
 * untouched); no match or a failed list → `502 GITHUB_ERROR`.
 */
export async function leftoverHookError(octokit: Octokit, params: FindOwnHookParams): Promise<AppError> {
  let hookId: number | null;
  try {
    hookId = await findOwnHook(octokit, params);
  } catch {
    hookId = null;
  }
  if (hookId === null) {
    // Not passed to `mapGithubError`: any list failure (even 401/403/404) is 502 here (API.md step 4).
    return new GithubError();
  }
  const hookSettingsUrl = `https://github.com/${params.owner}/${params.repo}/settings/hooks/${hookId}`;
  return new AppError(409, 'WEBHOOK_EXISTS', "This repo still has this Zap's old webhook", { hookSettingsUrl });
}
