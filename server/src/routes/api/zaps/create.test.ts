import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { ZapDto } from '@zaps/shared';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { AppModel } from '../../../models/app.js';
import { ZapModel } from '../../../models/zap.js';
import { seedApps } from '../../../scripts/seed-apps.js';
import { useTestDb } from '../../../test/db.js';
import { createTestUser } from '../../../test/users.js';
import { findOwnedZap } from '../../../zaps/index.js';

useTestDb();

async function appId(key: string): Promise<string> {
  const app = await AppModel.findOne({ key }).orFail();
  return app._id.toString();
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Thank PRs',
    trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'acme', repo: 'api' } },
    action: {
      app: 'github',
      event: 'pull_request.comment',
      config: { body: 'Thanks @{{pr.author}} for opening this pull request!' },
    },
    ...overrides,
  };
}

describe('POST /api/zaps', () => {
  let githubId: string;

  beforeEach(async () => {
    await seedApps();
    githubId = await appId('github');
  });

  it('valid body → 201 ZapDto, disabled, saved without a webhook', async () => {
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user }))
      .post('/api/zaps')
      .send(body({ appId: githubId }));

    assert.equal(res.status, 201);
    const dto = res.body as ZapDto;
    assert.deepEqual(Object.keys(dto).sort(), [
      'action', 'appId', 'createdAt', 'enabled', 'id', 'name', 'trigger', 'updatedAt',
    ]);
    assert.equal(dto.enabled, false);
    assert.equal(dto.appId, githubId);
    assert.equal(dto.name, 'Thank PRs');
    assert.deepEqual(dto.trigger.config, { owner: 'acme', repo: 'api' });

    const stored = await ZapModel.findById(dto.id).orFail();
    assert.equal(stored.userId.toString(), user._id.toString());
    assert.equal(stored.webhook, null);
    assert.equal(stored.enabled, false);
  });

  it('ignores enabled/webhook in the body', async () => {
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user }))
      .post('/api/zaps')
      .send({ ...body({ appId: githubId }), enabled: true, webhook: { hookId: 1 } });

    assert.equal(res.status, 201);
    assert.equal(res.body.enabled, false);
    assert.equal((await ZapModel.findById(res.body.id).orFail()).webhook, null);
  });

  it("another user can't see it", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => owner }))
      .post('/api/zaps')
      .send(body({ appId: githubId }));

    assert.equal(res.status, 201);
    assert.equal(await ZapModel.countDocuments({ userId: other._id }), 0);
    await assert.rejects(findOwnedZap(other._id, res.body.id), { code: 'NOT_FOUND' });
  });

  it("appId of gitlab with trigger.app 'github' → 400 on appId", async () => {
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user }))
      .post('/api/zaps')
      .send(body({ appId: await appId('gitlab') }));

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(res.body.error.details[0].path, ['appId']);
    assert.equal(await ZapModel.countDocuments(), 0);
  });

  it('appId of a missing app → 400 on appId', async () => {
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user }))
      .post('/api/zaps')
      .send(body({ appId: new Types.ObjectId().toString() }));

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(res.body.error.details[0].path, ['appId']);
  });

  it('unknown token → 400 on action.config.body', async () => {
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user }))
      .post('/api/zaps')
      .send(
        body({
          appId: githubId,
          action: { app: 'github', event: 'pull_request.comment', config: { body: 'Hi {{pr.nope}}' } },
        }),
      );

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(res.body.error.details, [
      { path: ['action', 'config', 'body'], message: 'Unknown field {{pr.nope}}' },
    ]);
    assert.equal(await ZapModel.countDocuments(), 0);
  });

  it('missing fields → 400', async () => {
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user })).post('/api/zaps').send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('not JSON → 415', async () => {
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user }))
      .post('/api/zaps')
      .type('text/plain')
      .send('{}');
    assert.equal(res.status, 415);
  });

  it('signed out → 401', async () => {
    const res = await request(createApp()).post('/api/zaps').send(body({ appId: githubId }));
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });
});
