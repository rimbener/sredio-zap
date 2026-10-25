import { buildTokenValues, renderTemplate, type PullRequestPayload } from '@zaps/shared';
import { z } from 'zod';
import { decrypt } from '../crypto/token.js';
import { getOctokit } from '../github/octokit.js';
import { UserModel } from '../models/user.js';
import type { ZapDocument } from '../models/zap.js';
import { ZapRunModel } from '../models/zapRun.js';

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
 * Happy branch of Data-model.md → zapRuns: insert the `pending` run (the claim on the delivery),
 * render the comment, post it with the owner's token, then mark the run `success`.
 * Failed comments, duplicate deliveries and retries are E7.
 */
export async function handlePullRequestOpened(
  zap: ZapDocument,
  deliveryId: string,
  payload: PullRequestPayload,
  key: Buffer,
): Promise<void> {
  const { pull_request: pr } = payload;
  const run = await ZapRunModel.create({
    zapId: zap._id,
    userId: zap.userId,
    deliveryId,
    status: 'pending',
    input: { prNumber: pr.number, prUrl: pr.html_url },
  });

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

  run.status = 'success';
  run.output = { commentUrl: comment.html_url };
  await run.save();
}
