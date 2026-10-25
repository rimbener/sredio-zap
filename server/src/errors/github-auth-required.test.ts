import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Octokit } from '@octokit/rest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import { encrypt } from '../crypto/token.js';
import { getTokenEncryptionKey } from '../env.js';
import { resetOctokitFactory, setOctokitFactory } from '../github/octokit.js';
import { UserModel, type UserDocument } from '../models/user.js';
import { ZapModel } from '../models/zap.js';
import { useTestDb } from '../test/db.js';
import { githubRequestError } from '../test/github-errors.js';
import { createTestUser } from '../test/users.js';
import { createTestZap, testWebhook } from '../test/zaps.js';

useTestDb();

const SIGN_IN_HEADER = 'x-test-sign-in';

function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

function countSessions(): Promise<number> {
  return mongoose.connection.collection('sessions').countDocuments();
}

/** Every GitHub call the routes make throws a GitHub `401` (revoked token). */
function revokedToken() {
  const unauthorized = async () => {
    throw githubRequestError(401);
  };
  const octokit = {
    rest: {
      repos: {
        listForAuthenticatedUser: unauthorized,
        createWebhook: unauthorized,
        deleteWebhook: unauthorized,
      },
    },
  } as unknown as Octokit;
  setOctokitFactory(() => octokit);
}

/** API.md → Errors (`GITHUB_AUTH_REQUIRED`), Conventions (Ending a session), Disable / Delete. */
describe('revoked GitHub token (E2)', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const created = await createTestUser();
    created.accessToken = encrypt('gho_revoked', getTokenEncryptionKey()) as never;
    await created.save();
    user = await UserModel.findById(created._id).orFail();
    // A real session (same pattern as the logout test): the sign-in header calls `req.login`,
    // every other request is authenticated by the `zaps.sid` cookie alone.
    app = createApp({
      authenticateAs: async (req) => {
        if (req.get(SIGN_IN_HEADER)) {
          await new Promise<void>((resolve, reject) => req.login(user, (err) => (err ? reject(err) : resolve())));
        }
        return null;
      },
    });
    revokedToken();
  });

  afterEach(() => resetOctokitFactory());

  async function signIn(): Promise<string> {
    const res = await request(app).get('/api/me').set(SIGN_IN_HEADER, '1');
    assert.equal(res.status, 200);
    const cookie = setCookies(res).find((c) => c.startsWith('zaps.sid='));
    assert.ok(cookie, 'expected a zaps.sid cookie');
    return cookie.split(';')[0]!;
  }

  async function assertSignedOut(res: request.Response, cookie: string) {
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'GITHUB_AUTH_REQUIRED');
    const cleared = setCookies(res).find((c) => c.startsWith('zaps.sid='));
    assert.ok(cleared, 'expected zaps.sid to be cleared');
    assert.match(cleared, /^zaps\.sid=;/);
    assert.match(cleared, /Expires=Thu, 01 Jan 1970/);
    assert.equal(await countSessions(), 0);
    const me = await request(app).get('/api/me').set('Cookie', cookie);
    assert.equal(me.status, 401);
    assert.equal(me.body.error.code, 'UNAUTHENTICATED');
  }

  it('GET /api/github/repos → 401 GITHUB_AUTH_REQUIRED and the session is ended', async () => {
    const cookie = await signIn();
    assert.equal(await countSessions(), 1);

    const res = await request(app).get('/api/github/repos').set('Cookie', cookie);

    await assertSignedOut(res, cookie);
  });

  it('enable → 401 GITHUB_AUTH_REQUIRED, the session is ended and the Zap stays disabled', async () => {
    const cookie = await signIn();
    const zap = await createTestZap(user._id);

    const res = await request(app)
      .post(`/api/zaps/${zap._id.toString()}/enable`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send({});

    await assertSignedOut(res, cookie);
    const stored = await ZapModel.findById(zap._id).orFail();
    assert.equal(stored.enabled, false);
    assert.equal(stored.webhook, null);
  });

  it('disable with a GitHub 401 → 200 and the session stays valid', async () => {
    const cookie = await signIn();
    const zap = await createTestZap(user._id, { enabled: true, webhook: testWebhook(42) });

    const res = await request(app)
      .post(`/api/zaps/${zap._id.toString()}/disable`)
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send({});

    assert.equal(res.status, 200);
    assert.equal(res.body.enabled, false);
    assert.equal(setCookies(res).find((c) => c.startsWith('zaps.sid=;')), undefined);
    assert.equal(await countSessions(), 1);
    const me = await request(app).get('/api/me').set('Cookie', cookie);
    assert.equal(me.status, 200);
  });

  it('delete with a GitHub 401 → 204 and the session stays valid', async () => {
    const cookie = await signIn();
    const zap = await createTestZap(user._id, { enabled: true, webhook: testWebhook(43) });

    const res = await request(app).delete(`/api/zaps/${zap._id.toString()}`).set('Cookie', cookie);

    assert.equal(res.status, 204);
    assert.equal(await ZapModel.findById(zap._id), null);
    assert.equal(await countSessions(), 1);
    const me = await request(app).get('/api/me').set('Cookie', cookie);
    assert.equal(me.status, 200);
  });
});
