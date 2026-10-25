import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { encrypt } from '../../../crypto/token.js';
import { getTokenEncryptionKey } from '../../../env.js';
import { resetOctokitFactory, setOctokitFactory } from '../../../github/octokit.js';
import { ZapModel } from '../../../models/zap.js';
import { useTestDb } from '../../../test/db.js';
import { TEST_ENV } from '../../../test/env.js';
import { fakeHooksOctokit, type FakeHooksOptions } from '../../../test/fake-github-hooks.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap } from '../../../test/zaps.js';
import type { UserDocument } from '../../../models/user.js';

useTestDb();

const hookUrl = (zapId: string) => `${TEST_ENV.WEBHOOK_PUBLIC_URL}?zap=${zapId}`;
const otherHooks = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: from + i, url: hookUrl(new Types.ObjectId().toString()) }));

/** E4: enable when GitHub refuses the create with 422 (API.md → Create-webhook routine, steps 2–4). */
describe('POST /api/zaps/:id/enable with a leftover webhook', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    user = await createTestUser();
    user.accessToken = encrypt('gho_owner_token', getTokenEncryptionKey()) as never;
    await user.save();
    app = createApp({ authenticateAs: () => user });
  });

  afterEach(() => resetOctokitFactory());

  async function enableWith(options: (zapId: string) => FakeHooksOptions) {
    const zap = await createTestZap(user._id, { owner: 'acme', repo: 'api' });
    const id = zap._id.toString();
    const gh = fakeHooksOctokit({ createStatus: 422, ...options(id) });
    setOctokitFactory(() => gh.octokit);
    const res = await request(app).post(`/api/zaps/${id}/enable`).set('Content-Type', 'application/json').send({});
    const stored = await ZapModel.findById(id).orFail();
    return { res, stored, requests: gh.requests };
  }

  it("returns 409 WEBHOOK_EXISTS with the hook's settings URL when it's on page 2, and keeps the Zap disabled", async () => {
    const { res, stored, requests } = await enableWith((id) => ({
      hookPages: [otherHooks(1, 100), [...otherHooks(200, 3), { id: 987, url: hookUrl(id) }]],
    }));

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'WEBHOOK_EXISTS');
    assert.deepEqual(res.body.error.details, {
      hookSettingsUrl: 'https://github.com/acme/api/settings/hooks/987',
    });
    assert.equal(stored.enabled, false);
    assert.equal(stored.webhook, null);
    // Create, then both list pages with per_page=100; the hook itself is never touched.
    assert.deepEqual(
      requests.map((r) => r.split('?')[0]),
      ['POST /repos/acme/api/hooks', 'GET /repos/acme/api/hooks', 'GET /repos/acme/api/hooks'],
    );
    assert.match(requests[1], /per_page=100/);
  });

  it('returns 502 GITHUB_ERROR when no hook matches', async () => {
    const { res, stored } = await enableWith(() => ({ hookPages: [otherHooks(1, 5)] }));
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'GITHUB_ERROR');
    assert.equal(stored.enabled, false);
    assert.equal(stored.webhook, null);
  });

  it('returns 502 GITHUB_ERROR when listing the hooks fails', async () => {
    const { res, stored } = await enableWith(() => ({ hookPages: 'fail' }));
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'GITHUB_ERROR');
    assert.equal(stored.enabled, false);
  });

  it('a 404 from the hooks list is still 502 GITHUB_ERROR, not REPO_NOT_ACCESSIBLE', async () => {
    const { res, stored } = await enableWith(() => ({ hookPages: 'fail', listFailStatus: 404 }));
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'GITHUB_ERROR');
    assert.equal(stored.enabled, false);
  });

  it("doesn't match a hook of a different Zap on the same repo", async () => {
    const other = await createTestZap(user._id, { owner: 'acme', repo: 'api' });
    const { res } = await enableWith(() => ({ hookPages: [[{ id: 55, url: hookUrl(other._id.toString()) }]] }));
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'GITHUB_ERROR');
  });
});
