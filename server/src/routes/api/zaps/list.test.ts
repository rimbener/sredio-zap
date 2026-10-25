import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ZapDto } from '@zaps/shared';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../../app.js';
import type { ZapDocument } from '../../../models/zap.js';
import { useTestDb } from '../../../test/db.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap, testWebhook } from '../../../test/zaps.js';

useTestDb();

/** Sets `updatedAt` directly (bypassing timestamps) so the sort order is deterministic. */
async function setUpdatedAt(zap: ZapDocument, iso: string): Promise<void> {
  await zap.collection.updateOne({ _id: zap._id }, { $set: { updatedAt: new Date(iso) } });
}

describe('GET /api/zaps', () => {
  it("returns only the session user's Zaps, newest updatedAt first", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const older = await createTestZap(user._id, { name: 'Older' });
    const newer = await createTestZap(user._id, { name: 'Newer', enabled: true, webhook: testWebhook(1) });
    const middle = await createTestZap(user._id, { name: 'Middle' });
    await createTestZap(other._id, { name: 'Not mine' });
    await setUpdatedAt(older, '2026-01-01T00:00:00.000Z');
    await setUpdatedAt(newer, '2026-03-01T00:00:00.000Z');
    await setUpdatedAt(middle, '2026-02-01T00:00:00.000Z');

    const res = await request(createApp({ authenticateAs: () => user })).get('/api/zaps');

    assert.equal(res.status, 200);
    const zaps = res.body as ZapDto[];
    assert.deepEqual(zaps.map((zap) => zap.name), ['Newer', 'Middle', 'Older']);
    assert.equal(zaps[0].id, newer._id.toString());
    assert.equal(zaps[0].updatedAt, '2026-03-01T00:00:00.000Z');
    assert.equal(zaps[0].enabled, true);
    for (const zap of zaps) {
      assert.deepEqual(Object.keys(zap).sort(), [
        'action', 'appId', 'createdAt', 'enabled', 'id', 'name', 'trigger', 'updatedAt',
      ]);
    }
    assert.ok(!JSON.stringify(res.body).includes('userId'));
    assert.ok(!JSON.stringify(res.body).includes('webhook'));
  });

  it('returns [] for a user without Zaps', async () => {
    const user = await createTestUser();
    await createTestZap((await createTestUser())._id);

    const res = await request(createApp({ authenticateAs: () => user })).get('/api/zaps');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('?appId= filters to Zaps of that app', async () => {
    const user = await createTestUser();
    const appA = new Types.ObjectId();
    const appB = new Types.ObjectId();
    await createTestZap(user._id, { name: 'A', appId: appA });
    await createTestZap(user._id, { name: 'B', appId: appB });

    const res = await request(createApp({ authenticateAs: () => user }))
      .get('/api/zaps')
      .query({ appId: appA.toString() });

    assert.equal(res.status, 200);
    assert.deepEqual((res.body as ZapDto[]).map((zap) => zap.name), ['A']);
    assert.equal((res.body as ZapDto[])[0].appId, appA.toString());
  });

  it('?appId=abc → 400 VALIDATION_ERROR, not a 500', async () => {
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user }))
      .get('/api/zaps')
      .query({ appId: 'abc' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('signed out → 401 UNAUTHENTICATED', async () => {
    const res = await request(createApp()).get('/api/zaps');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });
});
