import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { useTestDb } from '../test/db.js';
import { createTestUser } from '../test/users.js';
import { createTestZap, testWebhook } from '../test/zaps.js';
import type { UserDocument } from './user.js';
import { ZapModel } from './zap.js';
import { ZAP_RUN_TTL_SECONDS, ZapRunModel } from './zapRun.js';

useTestDb();

describe('Zap model', () => {
  let user: UserDocument;

  beforeEach(async () => {
    user = await createTestUser();
  });

  it('defaults to disabled with webhook null, and has timestamps', async () => {
    const zap = await createTestZap(user._id);
    const found = await ZapModel.findById(zap._id).lean();
    assert.ok(found);
    assert.equal(found.enabled, false);
    assert.equal(found.webhook, null);
    assert.ok(found.createdAt instanceof Date);
    assert.ok(found.updatedAt instanceof Date);
  });

  it('lets two disabled Zaps with webhook null both save (partial index)', async () => {
    await createTestZap(user._id);
    await createTestZap(user._id);
    assert.equal(await ZapModel.countDocuments(), 2);
  });

  it('rejects two Zaps with the same webhook.hookId', async () => {
    await createTestZap(user._id, { enabled: true, webhook: testWebhook(123) });
    await assert.rejects(
      createTestZap(user._id, { enabled: true, webhook: testWebhook(123) }),
      /duplicate key/,
    );
  });

  it('allows different hookIds', async () => {
    await createTestZap(user._id, { enabled: true, webhook: testWebhook(1) });
    await createTestZap(user._id, { enabled: true, webhook: testWebhook(2) });
    assert.equal(await ZapModel.countDocuments(), 2);
  });

  it('enforces name length 1–100', async () => {
    await assert.rejects(createTestZap(user._id, { name: '' }), /name/);
    await assert.rejects(createTestZap(user._id, { name: 'x'.repeat(101) }), /name/);
    await createTestZap(user._id, { name: 'x'.repeat(100) });
  });

  it('declares the list indexes', async () => {
    const indexes = await ZapModel.collection.indexes();
    const keys = indexes.map((index) => JSON.stringify(index.key));
    assert.ok(keys.includes(JSON.stringify({ userId: 1, updatedAt: -1 })));
    assert.ok(keys.includes(JSON.stringify({ userId: 1, appId: 1, updatedAt: -1 })));
    const hook = indexes.find((index) => index.key['webhook.hookId'] === 1);
    assert.equal(hook?.unique, true);
    assert.deepEqual(hook?.partialFilterExpression, { 'webhook.hookId': { $type: 'number' } });
  });
});

describe('ZapRun model', () => {
  it('has a unique deliveryId, a zap/createdAt index and a 7-day TTL on createdAt', async () => {
    const indexes = await ZapRunModel.collection.indexes();
    const delivery = indexes.find((index) => index.key.deliveryId === 1);
    assert.equal(delivery?.unique, true);
    assert.ok(indexes.some((index) => JSON.stringify(index.key) === JSON.stringify({ zapId: 1, createdAt: -1 })));
    const ttl = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify({ createdAt: 1 }));
    assert.equal(ttl?.expireAfterSeconds, ZAP_RUN_TTL_SECONDS);
    assert.equal(ZAP_RUN_TTL_SECONDS, 7 * 24 * 60 * 60);
  });

  it('defaults to pending with null output and error, and rejects a duplicate deliveryId', async () => {
    const user = await createTestUser();
    const zap = await createTestZap(user._id);
    const fields = {
      zapId: zap._id,
      userId: user._id,
      deliveryId: 'delivery-1',
      input: { prNumber: 1, prUrl: 'https://github.com/octocat/hello-world/pull/1' },
    };
    const run = await ZapRunModel.create(fields);
    assert.equal(run.status, 'pending');
    assert.equal(run.output, null);
    assert.equal(run.error, null);
    await assert.rejects(ZapRunModel.create(fields), /duplicate key/);
  });
});
