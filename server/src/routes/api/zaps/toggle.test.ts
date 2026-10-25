import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Octokit } from '@octokit/rest';
import type { ZapDto } from '@zaps/shared';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { decrypt, encrypt } from '../../../crypto/token.js';
import { getTokenEncryptionKey } from '../../../env.js';
import { resetOctokitFactory, setOctokitFactory } from '../../../github/octokit.js';
import { UserModel, type UserDocument } from '../../../models/user.js';
import { ZapModel } from '../../../models/zap.js';
import { useTestDb } from '../../../test/db.js';
import { TEST_ENV } from '../../../test/env.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap } from '../../../test/zaps.js';

useTestDb();

type Params = Record<string, unknown>;

/** A fake Octokit recording `createWebhook` / `deleteWebhook` calls and the token used. */
function fakeOctokit(hookId = 4242) {
  const created: Params[] = [];
  const deleted: Params[] = [];
  const tokens: string[] = [];
  const octokit = {
    rest: {
      repos: {
        createWebhook: async (params: Params) => {
          created.push(params);
          // Hook ids are unique per Zap (unique index), so each create gets the next one.
          return { status: 201, data: { id: hookId + created.length - 1 } };
        },
        deleteWebhook: async (params: Params) => {
          deleted.push(params);
          return { status: 204, data: undefined };
        },
      },
    },
  } as unknown as Octokit;
  setOctokitFactory((token) => {
    tokens.push(token);
    return octokit;
  });
  return { created, deleted, tokens };
}

async function userWithToken(token: string): Promise<UserDocument> {
  const user = await createTestUser();
  user.accessToken = encrypt(token, getTokenEncryptionKey()) as never;
  await user.save();
  return UserModel.findById(user._id).orFail();
}

function post(app: ReturnType<typeof createApp>, path: string) {
  return request(app).post(path).set('Content-Type', 'application/json').send({});
}

describe('POST /api/zaps/:id/enable and /disable', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    user = await userWithToken('gho_owner_token');
    app = createApp({ authenticateAs: () => user });
  });

  afterEach(() => resetOctokitFactory());

  it('enable creates the documented hook, stores hookId and an encrypted secret', async () => {
    const gh = fakeOctokit(4242);
    const zap = await createTestZap(user._id, { owner: 'acme', repo: 'api' });
    const id = zap._id.toString();

    const res = await post(app, `/api/zaps/${id}/enable`);

    assert.equal(res.status, 200);
    const dto = res.body as ZapDto;
    assert.equal(dto.id, id);
    assert.equal(dto.enabled, true);
    assert.equal('webhook' in dto, false);
    assert.ok(!JSON.stringify(res.body).includes('secret'));

    assert.deepEqual(gh.tokens, ['gho_owner_token']);
    assert.equal(gh.created.length, 1);
    const { config, ...rest } = gh.created[0] as { config: Params } & Params;
    assert.deepEqual(rest, { owner: 'acme', repo: 'api', active: true, events: ['pull_request'] });
    assert.equal(config.url, `${TEST_ENV.WEBHOOK_PUBLIC_URL}?zap=${id}`);
    assert.equal(config.content_type, 'json');
    assert.equal(config.insecure_ssl, '0');
    assert.match(config.secret as string, /^[0-9a-f]{64}$/);

    const stored = await ZapModel.findById(id).orFail();
    assert.equal(stored.enabled, true);
    assert.equal(stored.webhook?.hookId, 4242);
    const encrypted = stored.webhook!.secret;
    assert.notEqual(encrypted.ciphertext, config.secret);
    assert.equal(decrypt(encrypted as never, getTokenEncryptionKey()), config.secret);
  });

  it('each enable uses a fresh secret', async () => {
    const gh = fakeOctokit();
    const a = await createTestZap(user._id);
    const b = await createTestZap(user._id, { repo: 'other' });
    await post(app, `/api/zaps/${a._id.toString()}/enable`);
    await post(app, `/api/zaps/${b._id.toString()}/enable`).expect(200);
    const secrets = gh.created.map((c) => (c.config as Params).secret);
    assert.notEqual(secrets[0], secrets[1]);
  });

  it('disable deletes the stored hook and clears webhook', async () => {
    const gh = fakeOctokit(77);
    const zap = await createTestZap(user._id, { owner: 'acme', repo: 'api' });
    const id = zap._id.toString();
    await post(app, `/api/zaps/${id}/enable`).expect(200);

    const res = await post(app, `/api/zaps/${id}/disable`);

    assert.equal(res.status, 200);
    assert.equal((res.body as ZapDto).enabled, false);
    assert.equal('webhook' in res.body, false);
    assert.deepEqual(gh.deleted, [{ owner: 'acme', repo: 'api', hook_id: 77 }]);
    const stored = await ZapModel.findById(id).orFail();
    assert.equal(stored.enabled, false);
    assert.equal(stored.webhook, null);
  });

  it("another user's Zap → 404 on enable and disable, no GitHub call", async () => {
    const gh = fakeOctokit();
    const other = await createTestUser();
    const zap = await createTestZap(other._id);
    for (const action of ['enable', 'disable']) {
      const res = await post(app, `/api/zaps/${zap._id.toString()}/${action}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    }
    assert.equal(gh.tokens.length, 0);
    assert.equal((await ZapModel.findById(zap._id).orFail()).enabled, false);
  });

  it('invalid id → 404', async () => {
    fakeOctokit();
    const res = await post(app, '/api/zaps/abc/enable');
    assert.equal(res.status, 404);
  });

  it('requires a JSON body (415) and a session (401)', async () => {
    fakeOctokit();
    const zap = await createTestZap(user._id);
    const path = `/api/zaps/${zap._id.toString()}/enable`;
    assert.equal((await request(app).post(path)).status, 415);
    const signedOut = await post(createApp(), path);
    assert.equal(signedOut.status, 401);
    assert.equal(signedOut.body.error.code, 'UNAUTHENTICATED');
  });
});
