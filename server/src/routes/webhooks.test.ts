import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Octokit } from '@octokit/rest';
import request from 'supertest';
import { createApp } from '../app.js';
import { encrypt } from '../crypto/token.js';
import { getTokenEncryptionKey } from '../env.js';
import { generateWebhookSecret } from '../github/webhooks.js';
import { resetOctokitFactory, setOctokitFactory } from '../github/octokit.js';
import { UserModel, type UserDocument } from '../models/user.js';
import type { ZapDocument } from '../models/zap.js';
import { ZapRunModel } from '../models/zapRun.js';
import { useTestDb } from '../test/db.js';
import { createTestUser } from '../test/users.js';
import { createTestZap } from '../test/zaps.js';

useTestDb();

const HOOK_ID = 4242;
const COMMENT_URL = 'https://github.com/octocat/hello-world/pull/7#issuecomment-1';

const prPayload = (action = 'opened') => ({
  action,
  number: 7,
  pull_request: {
    number: 7,
    title: 'Fix login redirect',
    body: null,
    html_url: 'https://github.com/octocat/hello-world/pull/7',
    user: { login: 'monalisa' },
  },
  repository: { name: 'hello-world', full_name: 'octocat/hello-world' },
});

const sign = (body: string, secret: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

interface CommentCall {
  token: string;
  params: Record<string, unknown>;
}

describe('POST /webhooks/github', () => {
  let user: UserDocument;
  let zap: ZapDocument;
  let secret: string;
  let calls: CommentCall[];

  beforeEach(async () => {
    const key = getTokenEncryptionKey();
    user = await createTestUser({ login: 'octocat' });
    await UserModel.updateOne({ _id: user._id }, { accessToken: encrypt('gho_owner', key) });
    secret = generateWebhookSecret();
    zap = await createTestZap(user._id, {
      enabled: true,
      body: 'Thanks @{{pr.author}} for #{{pr.number}} in {{repo.fullName}}!',
      webhook: { hookId: HOOK_ID, secret: encrypt(secret, key) },
    });

    calls = [];
    setOctokitFactory((token) => ({
      rest: {
        issues: {
          createComment: async (params: Record<string, unknown>) => {
            calls.push({ token, params });
            return { status: 201, data: { html_url: COMMENT_URL } };
          },
        },
      },
    }) as unknown as Octokit);
  });

  afterEach(() => resetOctokitFactory());

  function deliver(
    payload: unknown,
    { event = 'pull_request', hookId = String(HOOK_ID), signature }: {
      event?: string; hookId?: string; signature?: string;
    } = {},
  ) {
    const body = JSON.stringify(payload);
    return request(createApp())
      .post(`/webhooks/github?zap=${zap._id}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', event)
      .set('X-GitHub-Delivery', 'delivery-1')
      .set('X-GitHub-Hook-ID', hookId)
      .set('X-Hub-Signature-256', signature ?? sign(body, secret))
      .send(body);
  }

  it('pull_request.opened → 200, comments with the rendered body, one success run', async () => {
    const res = await deliver(prPayload());
    assert.equal(res.status, 200);

    assert.deepEqual(calls, [{
      token: 'gho_owner',
      params: {
        owner: 'octocat',
        repo: 'hello-world',
        issue_number: 7,
        body: 'Thanks @monalisa for #7 in octocat/hello-world!',
      },
    }]);

    const runs = await ZapRunModel.find().lean();
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'success');
    assert.equal(runs[0].deliveryId, 'delivery-1');
    assert.equal(runs[0].zapId.toString(), zap._id.toString());
    assert.equal(runs[0].userId.toString(), user._id.toString());
    assert.deepEqual(runs[0].input, { prNumber: 7, prUrl: 'https://github.com/octocat/hello-world/pull/7' });
    assert.deepEqual(runs[0].output, { commentUrl: COMMENT_URL });
  });

  it('bad signature → 401, no run, no comment', async () => {
    const res = await deliver(prPayload(), { signature: sign('{}', secret) });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    assert.equal(await ZapRunModel.countDocuments(), 0);
    assert.equal(calls.length, 0);
  });

  it('signature with another secret → 401', async () => {
    const body = JSON.stringify(prPayload());
    const res = await deliver(prPayload(), { signature: sign(body, generateWebhookSecret()) });
    assert.equal(res.status, 401);
    assert.equal(await ZapRunModel.countDocuments(), 0);
  });

  for (const signature of ['', 'sha256=abc', 'sha1=0123456789abcdef0123456789abcdef01234567']) {
    it(`malformed signature header ${JSON.stringify(signature)} → 401`, async () => {
      const res = await deliver(prPayload(), { signature });
      assert.equal(res.status, 401);
      assert.equal(await ZapRunModel.countDocuments(), 0);
    });
  }

  it('form-encoded delivery → 401', async () => {
    const body = `payload=${encodeURIComponent(JSON.stringify(prPayload()))}`;
    const res = await request(createApp())
      .post('/webhooks/github')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', 'delivery-1')
      .set('X-GitHub-Hook-ID', String(HOOK_ID))
      .set('X-Hub-Signature-256', sign(body, secret))
      .send(body);
    assert.equal(res.status, 401);
  });

  it('unknown hook id → 204', async () => {
    const res = await deliver(prPayload(), { hookId: '999' });
    assert.equal(res.status, 204);
    assert.equal(await ZapRunModel.countDocuments(), 0);
  });

  it('non-numeric hook id → 204', async () => {
    const res = await deliver(prPayload(), { hookId: 'abc' });
    assert.equal(res.status, 204);
  });

  it('disabled Zap → 204, no run', async () => {
    zap.enabled = false;
    await zap.save();
    const res = await deliver(prPayload());
    assert.equal(res.status, 204);
    assert.equal(await ZapRunModel.countDocuments(), 0);
    assert.equal(calls.length, 0);
  });

  it('ping → 204, no run', async () => {
    const res = await deliver({ zen: 'Keep it simple.', hook_id: HOOK_ID }, { event: 'ping' });
    assert.equal(res.status, 204);
    assert.equal(await ZapRunModel.countDocuments(), 0);
    assert.equal(calls.length, 0);
  });

  it('pull_request.closed → 204, no run', async () => {
    const res = await deliver(prPayload('closed'));
    assert.equal(res.status, 204);
    assert.equal(await ZapRunModel.countDocuments(), 0);
    assert.equal(calls.length, 0);
  });
});
