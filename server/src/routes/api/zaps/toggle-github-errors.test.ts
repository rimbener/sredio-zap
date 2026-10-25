import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Octokit } from '@octokit/rest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { encrypt } from '../../../crypto/token.js';
import { getTokenEncryptionKey } from '../../../env.js';
import { resetOctokitFactory, setOctokitFactory } from '../../../github/octokit.js';
import { UserModel, type UserDocument } from '../../../models/user.js';
import { ZapModel } from '../../../models/zap.js';
import { useTestDb } from '../../../test/db.js';
import { githubRequestError } from '../../../test/github-errors.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap } from '../../../test/zaps.js';

useTestDb();

/** A fake Octokit whose `createWebhook` always throws `err`. */
function failingCreate(err: unknown) {
  const octokit = {
    rest: {
      repos: {
        createWebhook: async () => {
          throw err;
        },
      },
    },
  } as unknown as Octokit;
  setOctokitFactory(() => octokit);
}

describe('POST /api/zaps/:id/enable: GitHub error mapping', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const created = await createTestUser();
    created.accessToken = encrypt('gho_owner_token', getTokenEncryptionKey()) as never;
    await created.save();
    user = await UserModel.findById(created._id).orFail();
    app = createApp({ authenticateAs: () => user });
  });

  afterEach(() => resetOctokitFactory());

  async function enable(err: unknown) {
    failingCreate(err);
    const zap = await createTestZap(user._id, { owner: 'acme', repo: 'private' });
    const res = await request(app)
      .post(`/api/zaps/${zap._id.toString()}/enable`)
      .set('Content-Type', 'application/json')
      .send({});
    const stored = await ZapModel.findById(zap._id).orFail();
    return { res, stored };
  }

  it('GitHub 404 → 422 REPO_NOT_ACCESSIBLE and the Zap stays disabled', async () => {
    const { res, stored } = await enable(githubRequestError(404));
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'REPO_NOT_ACCESSIBLE');
    assert.equal(stored.enabled, false);
    assert.equal(stored.webhook, null);
  });

  it('GitHub plain 403 → 422 REPO_NOT_ACCESSIBLE', async () => {
    const { res } = await enable(githubRequestError(403, { 'x-ratelimit-remaining': '10' }));
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'REPO_NOT_ACCESSIBLE');
  });

  it('rate-limit 403 → 502 GITHUB_ERROR and the Zap stays disabled', async () => {
    for (const headers of [{ 'retry-after': '30' }, { 'x-ratelimit-remaining': '0' }]) {
      const { res, stored } = await enable(githubRequestError(403, headers));
      assert.equal(res.status, 502);
      assert.equal(res.body.error.code, 'GITHUB_ERROR');
      assert.equal(stored.enabled, false);
      assert.equal(stored.webhook, null);
    }
  });

  it('GitHub 500 or a network failure → 502 GITHUB_ERROR', async () => {
    for (const err of [githubRequestError(500), new TypeError('fetch failed')]) {
      const { res } = await enable(err);
      assert.equal(res.status, 502);
      assert.equal(res.body.error.code, 'GITHUB_ERROR');
    }
  });

  it('GitHub 401 → 401 GITHUB_AUTH_REQUIRED and the Zap stays disabled', async () => {
    const { res, stored } = await enable(githubRequestError(401));
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'GITHUB_AUTH_REQUIRED');
    assert.equal(stored.enabled, false);
  });
});
