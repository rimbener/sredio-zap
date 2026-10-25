import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Octokit } from '@octokit/rest';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { encrypt } from '../../../crypto/token.js';
import { getTokenEncryptionKey } from '../../../env.js';
import { resetOctokitFactory, setOctokitFactory } from '../../../github/octokit.js';
import { UserModel, type UserDocument } from '../../../models/user.js';
import { ZapModel } from '../../../models/zap.js';
import { ZapRunModel } from '../../../models/zapRun.js';
import { useTestDb } from '../../../test/db.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap, testWebhook } from '../../../test/zaps.js';

useTestDb();

let nextDelivery = 0;

async function insertRuns(zapId: Types.ObjectId, userId: Types.ObjectId, count: number) {
  await ZapRunModel.create(
    Array.from({ length: count }, (_, i) => ({
      zapId,
      userId,
      deliveryId: `delivery-${nextDelivery++}`,
      status: 'success',
      input: { prNumber: i + 1, prUrl: `https://github.com/octocat/hello-world/pull/${i + 1}` },
      output: { commentUrl: `https://github.com/octocat/hello-world/pull/${i + 1}#c` },
    })),
  );
}

interface DeleteHookCall {
  token: string;
  params: Record<string, unknown>;
}

describe('DELETE /api/zaps/:id', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;
  let calls: DeleteHookCall[];

  beforeEach(async () => {
    const created = await createTestUser();
    await UserModel.updateOne(
      { _id: created._id },
      { accessToken: encrypt('gho_owner', getTokenEncryptionKey()) },
    );
    user = (await UserModel.findById(created._id))!;
    app = createApp({ authenticateAs: () => user });

    calls = [];
    setOctokitFactory((token) => ({
      rest: {
        repos: {
          deleteWebhook: async (params: Record<string, unknown>) => {
            calls.push({ token, params });
            return { status: 204 };
          },
        },
      },
    }) as unknown as Octokit);
  });

  afterEach(() => resetOctokitFactory());

  it('enabled Zap → removes its webhook, deletes the Zap and only its runs → 204', async () => {
    const zap = await createTestZap(user._id, {
      enabled: true,
      owner: 'octocat',
      repo: 'hello-world',
      webhook: testWebhook(77),
    });
    const otherZap = await createTestZap(user._id);
    await insertRuns(zap._id, user._id, 3);
    await insertRuns(otherZap._id, user._id, 2);

    const res = await request(app).delete(`/api/zaps/${zap._id.toString()}`);

    assert.equal(res.status, 204);
    assert.equal(res.text, '');
    assert.deepEqual(calls, [
      { token: 'gho_owner', params: { owner: 'octocat', repo: 'hello-world', hook_id: 77 } },
    ]);
    assert.equal(await ZapModel.countDocuments({ _id: zap._id }), 0);
    assert.equal(await ZapRunModel.countDocuments({ zapId: zap._id }), 0);
    assert.equal(await ZapModel.countDocuments({ _id: otherZap._id }), 1);
    assert.equal(await ZapRunModel.countDocuments({ zapId: otherZap._id }), 2);
  });

  for (const status of [404, 500, 401]) {
    it(`GitHub ${status} on webhook removal → still 204, Zap and runs gone, session intact`, async () => {
      setOctokitFactory((token) => ({
        rest: {
          repos: {
            deleteWebhook: async (params: Record<string, unknown>) => {
              calls.push({ token, params });
              throw Object.assign(new Error(`GitHub ${status}`), { status });
            },
          },
        },
      }) as unknown as Octokit);
      const zap = await createTestZap(user._id, { enabled: true, webhook: testWebhook(99) });
      await insertRuns(zap._id, user._id, 2);

      const res = await request(app).delete(`/api/zaps/${zap._id.toString()}`);

      assert.equal(res.status, 204);
      assert.equal(calls.length, 1);
      assert.equal(res.headers['set-cookie'], undefined);
      assert.equal(await ZapModel.countDocuments({ _id: zap._id }), 0);
      assert.equal(await ZapRunModel.countDocuments({ zapId: zap._id }), 0);
    });
  }

  it('disabled Zap → no GitHub call → 204', async () => {
    const zap = await createTestZap(user._id);
    await insertRuns(zap._id, user._id, 1);

    const res = await request(app).delete(`/api/zaps/${zap._id.toString()}`);

    assert.equal(res.status, 204);
    assert.equal(calls.length, 0);
    assert.equal(await ZapModel.countDocuments({ _id: zap._id }), 0);
    assert.equal(await ZapRunModel.countDocuments({ zapId: zap._id }), 0);
  });

  it("another user's Zap → 404 NOT_FOUND, nothing deleted", async () => {
    const other = await createTestUser();
    const zap = await createTestZap(other._id, { enabled: true, webhook: testWebhook(88) });
    await insertRuns(zap._id, other._id, 2);

    const res = await request(app).delete(`/api/zaps/${zap._id.toString()}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.equal(calls.length, 0);
    assert.equal(await ZapModel.countDocuments({ _id: zap._id }), 1);
    assert.equal(await ZapRunModel.countDocuments({ zapId: zap._id }), 2);
  });

  it('missing Zap or invalid id → 404 NOT_FOUND', async () => {
    for (const id of [new Types.ObjectId().toString(), 'not-an-id']) {
      const res = await request(app).delete(`/api/zaps/${id}`);
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    }
  });

  it('no Content-Type needed (DELETE is not checked by requireJson)', async () => {
    const zap = await createTestZap(user._id);
    const res = await request(app).delete(`/api/zaps/${zap._id.toString()}`).set('Content-Type', 'text/plain');
    assert.equal(res.status, 204);
  });

  it('signed out → 401 UNAUTHENTICATED', async () => {
    const res = await request(createApp()).delete(`/api/zaps/${new Types.ObjectId().toString()}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });
});
