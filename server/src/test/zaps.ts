import { Types } from 'mongoose';
import { ZapModel, type ZapDocument } from '../models/zap.js';

/**
 * Inserts a disabled Zap (`webhook: null`) for tests. `appId` defaults to a fresh ObjectId;
 * seed the apps and pass the GitHub app's `_id` when a test needs a real reference.
 */
export async function createTestZap(
  userId: Types.ObjectId,
  overrides: Partial<{
    appId: Types.ObjectId;
    name: string;
    enabled: boolean;
    owner: string;
    repo: string;
    body: string;
    webhook: { hookId: number; secret: { iv: string; authTag: string; ciphertext: string } } | null;
  }> = {},
): Promise<ZapDocument> {
  return ZapModel.create({
    userId,
    appId: overrides.appId ?? new Types.ObjectId(),
    name: overrides.name ?? 'Comment on new PRs',
    enabled: overrides.enabled ?? false,
    trigger: {
      app: 'github',
      event: 'pull_request.opened',
      config: { owner: overrides.owner ?? 'octocat', repo: overrides.repo ?? 'hello-world' },
    },
    action: {
      app: 'github',
      event: 'pull_request.comment',
      config: { body: overrides.body ?? 'Thanks @{{pr.author}} for opening this pull request!' },
    },
    webhook: overrides.webhook ?? null,
  });
}

/** A placeholder webhook (not a real encryption) for index tests. */
export function testWebhook(hookId: number) {
  return { hookId, secret: { iv: 'aXY=', authTag: 'dGFn', ciphertext: 'c2VjcmV0' } };
}
