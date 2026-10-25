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
import { runErrorMessage } from '../webhooks/run-status.js';

// E7: failed comments, duplicate deliveries and retries (Data-model.md → zapRuns).
useTestDb();

const HOOK_ID = 4343;
const DELIVERY_ID = 'delivery-e7';
const COMMENT_URL = 'https://github.com/octocat/hello-world/pull/7#issuecomment-1';

const payload = {
  action: 'opened',
  number: 7,
  pull_request: {
    number: 7,
    title: 'Fix login redirect',
    body: null,
    html_url: 'https://github.com/octocat/hello-world/pull/7',
    user: { login: 'monalisa' },
  },
  repository: { name: 'hello-world', full_name: 'octocat/hello-world' },
};

/** Mimics an Octokit `RequestError` (an `Error` with a numeric `status`). */
function githubError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

describe('POST /webhooks/github: failed runs, duplicates, retry', () => {
  let user: UserDocument;
  let zap: ZapDocument;
  let secret: string;
  let calls: number;
  /** What the fake `createComment` does next; defaults to success. */
  let failWith: Error | null;
  /** Lets a test hold `createComment` open (e.g. to race two deliveries). */
  let gate: Promise<void> | null;

  beforeEach(async () => {
    const key = getTokenEncryptionKey();
    user = await createTestUser({ login: 'octocat' });
    await UserModel.updateOne({ _id: user._id }, { accessToken: encrypt('gho_owner', key) });
    secret = generateWebhookSecret();
    zap = await createTestZap(user._id, {
      enabled: true,
      body: 'Thanks @{{pr.author}}!',
      webhook: { hookId: HOOK_ID, secret: encrypt(secret, key) },
    });

    calls = 0;
    failWith = null;
    gate = null;
    setOctokitFactory(() => ({
      rest: {
        issues: {
          createComment: async () => {
            calls += 1;
            if (gate) await gate;
            if (failWith) throw failWith;
            return { status: 201, data: { html_url: COMMENT_URL } };
          },
        },
      },
    }) as unknown as Octokit);
  });

  afterEach(() => resetOctokitFactory());

  function deliver(deliveryId = DELIVERY_ID) {
    const body = JSON.stringify(payload);
    return request(createApp())
      .post(`/webhooks/github?zap=${zap._id}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-GitHub-Delivery', deliveryId)
      .set('X-GitHub-Hook-ID', String(HOOK_ID))
      .set('X-Hub-Signature-256', `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`)
      .send(body);
  }

  async function onlyRun() {
    const runs = await ZapRunModel.find().lean();
    assert.equal(runs.length, 1);
    return runs[0];
  }

  it('comment throws → 200, run failed with the GitHub status and message', async () => {
    failWith = githubError(401, 'Bad credentials');
    const res = await deliver();
    assert.equal(res.status, 200);
    assert.equal(calls, 1);

    const run = await onlyRun();
    assert.equal(run.status, 'failed');
    assert.equal(run.error, 'GitHub 401: Bad credentials');
    assert.equal(run.output, null);
  });

  it('owner missing before the comment → 200, run failed, no comment', async () => {
    await UserModel.deleteOne({ _id: user._id });
    const res = await deliver();
    assert.equal(res.status, 200);
    assert.equal(calls, 0);
    const run = await onlyRun();
    assert.equal(run.status, 'failed');
    assert.ok(run.error);
  });

  it('same delivery after a success → 200, no second comment', async () => {
    assert.equal((await deliver()).status, 200);
    const first = await onlyRun();

    const res = await deliver();
    assert.equal(res.status, 200);
    assert.equal(calls, 1);
    const run = await onlyRun();
    assert.equal(run.status, 'success');
    assert.deepEqual(run.output, { commentUrl: COMMENT_URL });
    assert.deepEqual(run.updatedAt, first.updatedAt);
  });

  it('same delivery after a failure → comment posted, same run now success', async () => {
    failWith = githubError(502, 'Bad gateway');
    await deliver();
    const failed = await onlyRun();
    assert.equal(failed.status, 'failed');

    failWith = null;
    const res = await deliver();
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
    const run = await onlyRun();
    assert.equal(run._id.toString(), failed._id.toString());
    assert.equal(run.status, 'success');
    assert.equal(run.error, null);
    assert.deepEqual(run.output, { commentUrl: COMMENT_URL });
  });

  it('retry that fails again → 200, run failed with the new error', async () => {
    failWith = githubError(500, 'first');
    await deliver();
    failWith = githubError(401, 'second');
    const res = await deliver();
    assert.equal(res.status, 200);
    assert.equal(calls, 2);
    const run = await onlyRun();
    assert.equal(run.status, 'failed');
    assert.equal(run.error, 'GitHub 401: second');
  });

  it('pending run + redelivery → 200, no comment (stuck pending is never retried)', async () => {
    await ZapRunModel.create({
      zapId: zap._id,
      userId: user._id,
      deliveryId: DELIVERY_ID,
      status: 'pending',
      input: { prNumber: 7, prUrl: payload.pull_request.html_url },
    });
    const res = await deliver();
    assert.equal(res.status, 200);
    assert.equal(calls, 0);
    assert.equal((await onlyRun()).status, 'pending');
  });

  it('two concurrent identical deliveries → exactly one createComment', async () => {
    let release!: () => void;
    gate = new Promise((resolve) => { release = resolve; });
    const both = Promise.all([deliver(), deliver()]);
    // Let both requests reach the claim before the winning comment call returns.
    const deadline = Date.now() + 5000;
    while (calls === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 10));
    await new Promise((r) => setTimeout(r, 100));
    release();

    const responses = await both;
    assert.deepEqual(responses.map((r) => r.status), [200, 200]);
    assert.equal(calls, 1);
    assert.equal((await onlyRun()).status, 'success');
  });

  it('concurrent redeliveries of a failed run → exactly one retry comment', async () => {
    failWith = githubError(500, 'boom');
    await deliver();
    failWith = null;
    calls = 0;

    const responses = await Promise.all([deliver(), deliver(), deliver()]);
    assert.deepEqual(responses.map((r) => r.status), [200, 200, 200]);
    assert.equal(calls, 1);
    assert.equal((await onlyRun()).status, 'success');
  });
});

describe('runErrorMessage', () => {
  it('prefixes the GitHub status when present', () => {
    assert.equal(runErrorMessage(githubError(404, 'Not Found')), 'GitHub 404: Not Found');
  });

  it('uses the message of a plain error, or the stringified value', () => {
    assert.equal(runErrorMessage(new Error('boom')), 'boom');
    assert.equal(runErrorMessage('oops'), 'oops');
  });
});
