import { buildTokenValues, renderTemplate, type PullRequestPayload } from '@zaps/shared';
import { z } from 'zod';
import { decrypt } from '../crypto/token.js';
import { getOctokit } from '../github/octokit.js';
import { UserModel } from '../models/user.js';
import type { ZapDocument } from '../models/zap.js';
import { claimRun } from './claim-run.js';
import { markRunFailed, markRunSucceeded } from './run-status.js';

/** The fields of a `pull_request` payload the receiver reads. Other fields are ignored. */
const pullRequestPayloadSchema = z.object({
  action: z.string(),
  pull_request: z.object({
    number: z.number().int(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: z.object({ login: z.string() }),
  }),
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
  }),
});

/** Returns the payload if it is a `pull_request.opened` event, else `null` (ignored with `204`). */
export function parseOpenedPullRequest(event: string | undefined, body: unknown): PullRequestPayload | null {
  if (event !== 'pull_request') return null;
  const result = pullRequestPayloadSchema.safeParse(body);
  if (!result.success || result.data.action !== 'opened') return null;
  return result.data;
}

/**
 * Data-model.md → zapRuns: claim the delivery with a `pending` run (or re-claim a `failed` one),
 * post the comment, then mark the run `success` or `failed`. A duplicate delivery whose run is
 * `success` or `pending` is skipped. A failure before or during the comment call is recorded as
 * a `failed` run and never thrown, so the receiver answers `200`. If marking `success` itself
 * fails, the run stays `pending` and is never retried (the comment was already posted).
 */
export async function handlePullRequestOpened(
  zap: ZapDocument,
  deliveryId: string,
  payload: PullRequestPayload,
  key: Buffer,
): Promise<void> {
  const run = await claimRun(zap, deliveryId, payload);
  if (!run) return;

  let commentUrl: string;
  try {
    commentUrl = await commentOnPullRequest(zap, payload, key);
  } catch (err) {
    await markRunFailed(run, err);
    return;
  }
  await markRunSucceeded(run, commentUrl);
}

/** Renders the action body and posts it on the PR with the owner's token. Returns the comment URL. */
async function commentOnPullRequest(zap: ZapDocument, payload: PullRequestPayload, key: Buffer): Promise<string> {
  const { pull_request: pr } = payload;
  const owner = await UserModel.findById(zap.userId).orFail();
  const octokit = getOctokit(decrypt(owner.accessToken, key));
  const { owner: repoOwner, repo } = zap.trigger.config as { owner: string; repo: string };
  const { body: template } = zap.action.config as { body: string };

  const { data: comment } = await octokit.rest.issues.createComment({
    owner: repoOwner,
    repo,
    issue_number: pr.number,
    body: renderTemplate(template, buildTokenValues(payload)),
  });

  return comment.html_url;
}
