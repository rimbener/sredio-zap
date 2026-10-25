import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import type { UserDocument } from '../models/user.js';
import { useTestDb } from '../test/db.js';
import { createTestUser } from '../test/users.js';
import { createTestZap, testWebhook } from '../test/zaps.js';
import { findOwnedZap, toZapDto } from './index.js';

useTestDb();

function isNotFound(error: unknown): boolean {
  return error instanceof AppError && error.status === 404 && error.code === 'NOT_FOUND';
}

describe('findOwnedZap', () => {
  let owner: UserDocument;

  beforeEach(async () => {
    owner = await createTestUser();
  });

  it("returns the owner's Zap", async () => {
    const zap = await createTestZap(owner._id);
    const found = await findOwnedZap(owner._id, zap._id.toString());
    assert.equal(found._id.toString(), zap._id.toString());
  });

  it("404s for another user's Zap", async () => {
    const other = await createTestUser();
    const zap = await createTestZap(other._id);
    await assert.rejects(findOwnedZap(owner._id, zap._id.toString()), isNotFound);
  });

  it('404s for an invalid ObjectId', async () => {
    await assert.rejects(findOwnedZap(owner._id, 'abc'), isNotFound);
  });

  it('404s for a missing Zap', async () => {
    await assert.rejects(findOwnedZap(owner._id, new Types.ObjectId().toString()), isNotFound);
  });
});

describe('toZapDto', () => {
  it('exposes id and ISO dates, never userId or webhook', async () => {
    const user = await createTestUser();
    const zap = await createTestZap(user._id, { enabled: true, webhook: testWebhook(9) });
    for (const source of [zap, await zap.collection.findOne({ _id: zap._id })]) {
      const dto = toZapDto(source as never);
      assert.deepEqual(Object.keys(dto).sort(), [
        'action', 'appId', 'createdAt', 'enabled', 'id', 'name', 'trigger', 'updatedAt',
      ]);
      assert.equal(dto.id, zap._id.toString());
      assert.equal(dto.appId, zap.appId.toString());
      assert.equal(dto.enabled, true);
      assert.deepEqual(dto.trigger, {
        app: 'github',
        event: 'pull_request.opened',
        config: { owner: 'octocat', repo: 'hello-world' },
      });
      assert.equal(dto.createdAt, zap.createdAt.toISOString());
      assert.equal(dto.updatedAt, zap.updatedAt.toISOString());
      assert.ok(!JSON.stringify(dto).includes('ciphertext'));
    }
  });
});
