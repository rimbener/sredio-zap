import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Octokit } from '@octokit/rest';
import { COMMENT_BODY_MAX_LENGTH } from '@zaps/shared';
import request from 'supertest';
import { createApp } from '../app.js';
import { encrypt } from '../crypto/token.js';
import { getTokenEncryptionKey } from '../env.js';
import { generateWebhookSecret } from '../github/webhooks.js';
import { resetOctokitFactory, setOctokitFactory } from '../github/octokit.js';
import { UserModel } from '../models/user.js';
import type { ZapDocument } from '../models/zap.js';
import { ZapRunModel } from '../models/zapRun.js';
import { useTestDb } from '../test/db.js';
import { createTestUser } from '../test/users.js';
import { createTestZap } from '../test/zaps.js';

// E11: long rendered comments are truncated to GitHub's limit (Data-model.md → Field mapping).

useTestDb();

const HOOK_ID = 4343;

describe('POST /webhooks/github: comment truncation', () => {
  let zap: ZapDocument;
  let secret: string;
  let bodies: string[];

  beforeEach(async () => {
    const key = getTokenEncryptionKey();
    const user = await createTestUser({ login: 'octocat' });
    await UserModel.updateOne({ _id: user._id }, { accessToken: encrypt('gho_owner', key) });
    secret = generateWebhookSecret();
    zap = await createTestZap(user._id, {
      enabled: true,
      body: 'Thanks @{{pr.author}}!\n\n{{pr.body}}',
      webhook: { hookId: HOOK_ID, secret: encrypt(secret, key) },
    });

    bodies = [];
    setOctokitFactory(() => ({
      rest: {
        issues: {
          createComment: async (params: { body: string }) => {
            bodies.push(params.body);
            return { status: 201, data: { html_url: 'https://github.com/octocat/hello-world/pull/7#issuecomment-1' } };
          },
        },
      },
    }) as unknown as Octokit);
  });

  afterEach(() => resetOctokitFactory());

  function deliver(prBody: string) {
    const body = JSON.stringify({
      action: 'opened',
      number: 7,
      pull_request: {
        number: 7,
        title: 'Añadir modo oscuro 🌙',
        body: prBody,
        html_url: 'https://github.com/octocat/hello-world/pull/7',
        user: { login: 'monalisa' },
      },
      repository: { name: 'hello-world', full_name: 'octocat/hello-world' },
    });
    return request(createApp())
      .post(`/webhooks/github?zap=${zap._id}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', 'delivery-long')
      .set('X-GitHub-Hook-ID', String(HOOK_ID))
      .set('X-Hub-Signature-256', `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`)
      .send(body);
  }

  it('a 70k-char PR body posts a comment of at most 65,536 code points ending in …', async () => {
    const res = await deliver('x'.repeat(70_000));
    assert.equal(res.status, 200);

    assert.equal(bodies.length, 1);
    const [comment] = bodies;
    assert.equal(Array.from(comment).length, COMMENT_BODY_MAX_LENGTH);
    assert.ok(comment.startsWith('Thanks @monalisa!\n\nxxx'));
    assert.ok(comment.endsWith('x…'));

    const runs = await ZapRunModel.find().lean();
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'success');
  });
});
