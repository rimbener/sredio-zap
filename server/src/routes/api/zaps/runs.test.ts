import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { ZapRunDto } from '@zaps/shared';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../../app.js';
import type { UserDocument } from '../../../models/user.js';
import { ZapRunModel } from '../../../models/zapRun.js';
import { useTestDb } from '../../../test/db.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap } from '../../../test/zaps.js';

useTestDb();

const BASE = Date.parse('2026-01-01T00:00:00.000Z');

/** Inserts `count` runs one minute apart (run `i` is created at BASE + i minutes). */
async function insertRuns(zapId: Types.ObjectId, userId: Types.ObjectId, count: number) {
  const docs = Array.from({ length: count }, (_, i) => {
    const createdAt = new Date(BASE + i * 60_000);
    const failed = i % 2 === 1;
    return {
      zapId,
      userId,
      deliveryId: `${zapId.toString()}-${i}`,
      status: failed ? 'failed' : 'success',
      input: { prNumber: i + 1, prUrl: `https://github.com/octocat/hello-world/pull/${i + 1}` },
      output: failed ? null : { commentUrl: `https://github.com/octocat/hello-world/pull/${i + 1}#c` },
      error: failed ? 'Bad credentials (401)' : null,
      createdAt,
      updatedAt: new Date(createdAt.getTime() + 1000),
    };
  });
  // Straight to the collection so the explicit `createdAt` values are kept.
  if (docs.length) await ZapRunModel.collection.insertMany(docs);
}

describe('GET /api/zaps/:id/runs', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    user = await createTestUser();
    app = createApp({ authenticateAs: () => user });
  });

  it('60 runs → the 50 newest, createdAt desc', async () => {
    const zap = await createTestZap(user._id);
    await insertRuns(zap._id, user._id, 60);

    const res = await request(app).get(`/api/zaps/${zap._id.toString()}/runs`);

    assert.equal(res.status, 200);
    const runs = res.body as ZapRunDto[];
    assert.equal(runs.length, 50);
    // Newest is run 59 (prNumber 60); oldest returned is run 10 (prNumber 11).
    assert.deepEqual(
      runs.map((run) => run.input.prNumber),
      Array.from({ length: 50 }, (_, i) => 60 - i),
    );
    assert.equal(runs[0].createdAt, new Date(BASE + 59 * 60_000).toISOString());
  });

  it('returns DTO fields only', async () => {
    const zap = await createTestZap(user._id);
    await insertRuns(zap._id, user._id, 2);

    const res = await request(app).get(`/api/zaps/${zap._id.toString()}/runs`);

    assert.equal(res.status, 200);
    const [failed, success] = res.body as ZapRunDto[];
    for (const run of [failed, success]) {
      assert.deepEqual(Object.keys(run).sort(), [
        'createdAt', 'error', 'id', 'input', 'output', 'status', 'updatedAt',
      ]);
      assert.match(run.id, /^[0-9a-f]{24}$/);
    }
    assert.deepEqual(failed, {
      id: failed.id,
      status: 'failed',
      input: { prNumber: 2, prUrl: 'https://github.com/octocat/hello-world/pull/2' },
      output: null,
      error: 'Bad credentials (401)',
      createdAt: new Date(BASE + 60_000).toISOString(),
      updatedAt: new Date(BASE + 61_000).toISOString(),
    });
    assert.deepEqual(success.output, {
      commentUrl: 'https://github.com/octocat/hello-world/pull/1#c',
    });
    assert.equal(success.error, null);
  });

  it("only the Zap's own runs", async () => {
    const zap = await createTestZap(user._id);
    const otherZap = await createTestZap(user._id);
    await insertRuns(zap._id, user._id, 1);
    await insertRuns(otherZap._id, user._id, 3);

    const res = await request(app).get(`/api/zaps/${zap._id.toString()}/runs`);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
  });

  it('no runs → empty array', async () => {
    const zap = await createTestZap(user._id);
    const res = await request(app).get(`/api/zaps/${zap._id.toString()}/runs`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it("another user's Zap → 404 NOT_FOUND", async () => {
    const other = await createTestUser();
    const zap = await createTestZap(other._id);
    await insertRuns(zap._id, other._id, 3);

    const res = await request(app).get(`/api/zaps/${zap._id.toString()}/runs`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('missing Zap or invalid id → 404 NOT_FOUND', async () => {
    for (const id of [new Types.ObjectId().toString(), 'not-an-id']) {
      const res = await request(app).get(`/api/zaps/${id}/runs`);
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    }
  });

  it('signed out → 401 UNAUTHENTICATED', async () => {
    const res = await request(createApp()).get(`/api/zaps/${new Types.ObjectId().toString()}/runs`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });
});
