import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { ZapDto } from '@zaps/shared';
import { Types } from 'mongoose';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { AppModel } from '../../../models/app.js';
import type { UserDocument } from '../../../models/user.js';
import { ZapModel, type ZapDocument } from '../../../models/zap.js';
import { seedApps } from '../../../scripts/seed-apps.js';
import { useTestDb } from '../../../test/db.js';
import { createTestUser } from '../../../test/users.js';
import { createTestZap } from '../../../test/zaps.js';

useTestDb();

const PAST = new Date('2026-01-01T00:00:00.000Z');

describe('GET/PATCH /api/zaps/:id', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;
  let githubId: Types.ObjectId;
  let zap: ZapDocument;

  beforeEach(async () => {
    await seedApps();
    githubId = (await AppModel.findOne({ key: 'github' }).orFail())._id;
    user = await createTestUser();
    app = createApp({ authenticateAs: () => user });
    zap = await createTestZap(user._id, { appId: githubId });
    // Push `updatedAt` into the past so a save visibly changes it.
    await ZapModel.collection.updateOne({ _id: zap._id }, { $set: { updatedAt: PAST } });
  });

  const path = () => `/api/zaps/${zap._id.toString()}`;

  describe('GET', () => {
    it('own Zap → 200 ZapDto', async () => {
      const res = await request(app).get(path());
      assert.equal(res.status, 200);
      const dto = res.body as ZapDto;
      assert.equal(dto.id, zap._id.toString());
      assert.equal(dto.appId, githubId.toString());
      assert.equal(dto.name, 'Comment on new PRs');
      assert.deepEqual(dto.trigger.config, { owner: 'octocat', repo: 'hello-world' });
      assert.equal('webhook' in dto, false);
      assert.equal('userId' in dto, false);
    });

    it("another user's Zap → 404", async () => {
      const other = await createTestUser();
      const res = await request(createApp({ authenticateAs: () => other })).get(path());
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('missing Zap → 404', async () => {
      const res = await request(app).get(`/api/zaps/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 404);
    });
  });

  describe('PATCH', () => {
    it('name only keeps trigger and action, and bumps updatedAt', async () => {
      const res = await request(app).patch(path()).send({ name: 'Renamed' });
      assert.equal(res.status, 200);
      const dto = res.body as ZapDto;
      assert.equal(dto.name, 'Renamed');
      assert.deepEqual(dto.trigger, {
        app: 'github',
        event: 'pull_request.opened',
        config: { owner: 'octocat', repo: 'hello-world' },
      });
      assert.deepEqual(dto.action, {
        app: 'github',
        event: 'pull_request.comment',
        config: { body: 'Thanks @{{pr.author}} for opening this pull request!' },
      });
      assert.ok(Date.parse(dto.updatedAt) > PAST.getTime());

      const stored = await ZapModel.findById(zap._id).orFail();
      assert.equal(stored.name, 'Renamed');
      assert.ok(stored.updatedAt > PAST);
    });

    it('trigger replaces the whole step (no deep merge)', async () => {
      const res = await request(app)
        .patch(path())
        .send({
          trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'acme', repo: 'api', extra: 1 } },
        });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.trigger.config, { owner: 'acme', repo: 'api' });
      assert.equal(res.body.name, 'Comment on new PRs');

      const stored = await ZapModel.findById(zap._id).orFail();
      assert.deepEqual(stored.trigger.config, { owner: 'acme', repo: 'api' });
    });

    it('a trigger without its config fields is rejected, not merged', async () => {
      const res = await request(app)
        .patch(path())
        .send({ trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'acme' } } });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      const stored = await ZapModel.findById(zap._id).orFail();
      assert.deepEqual(stored.trigger.config, { owner: 'octocat', repo: 'hello-world' });
    });

    it('action replaces the comment', async () => {
      const res = await request(app)
        .patch(path())
        .send({ action: { app: 'github', event: 'pull_request.comment', config: { body: 'Hi {{pr.author}}' } } });
      assert.equal(res.status, 200);
      assert.equal(res.body.action.config.body, 'Hi {{pr.author}}');
    });

    it('merged Zap with appId ↔ trigger.app mismatch → 400, nothing saved', async () => {
      const gitlabId = (await AppModel.findOne({ key: 'gitlab' }).orFail())._id.toString();
      const res = await request(app).patch(path()).send({ appId: gitlabId, name: 'Nope' });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.deepEqual(res.body.error.details.map((i: { path: string[] }) => i.path), [['appId']]);
      const stored = await ZapModel.findById(zap._id).orFail();
      assert.equal(stored.name, 'Comment on new PRs');
      assert.equal(stored.appId.toString(), githubId.toString());
    });

    it('unknown appId → 400', async () => {
      const res = await request(app).patch(path()).send({ appId: new Types.ObjectId().toString() });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('unknown token in the merged action → 400', async () => {
      const res = await request(app)
        .patch(path())
        .send({ action: { app: 'github', event: 'pull_request.comment', config: { body: '{{pr.nope}}' } } });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body.error.details[0].path, ['action', 'config', 'body']);
    });

    it('invalid name → 400', async () => {
      const res = await request(app).patch(path()).send({ name: '' });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('ignores enabled and webhook in the body', async () => {
      const res = await request(app).patch(path()).send({ enabled: true, webhook: { hookId: 1 } });
      assert.equal(res.status, 200);
      assert.equal(res.body.enabled, false);
      const stored = await ZapModel.findById(zap._id).orFail();
      assert.equal(stored.enabled, false);
      assert.equal(stored.webhook, null);
    });

    it("another user's Zap → 404, unchanged", async () => {
      const other = await createTestUser();
      const res = await request(createApp({ authenticateAs: () => other }))
        .patch(path())
        .send({ name: 'Hijacked' });
      assert.equal(res.status, 404);
      assert.equal((await ZapModel.findById(zap._id).orFail()).name, 'Comment on new PRs');
    });

    it('text/plain → 415', async () => {
      const res = await request(app).patch(path()).set('Content-Type', 'text/plain').send('{"name":"x"}');
      assert.equal(res.status, 415);
    });
  });
});
