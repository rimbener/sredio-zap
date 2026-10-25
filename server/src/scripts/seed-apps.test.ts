import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { APPS_SEED } from '@zaps/shared';
import { AppModel } from '../models/app.js';
import { useTestDb } from '../test/db.js';
import { seedApps } from './seed-apps.js';

useTestDb();

describe('seedApps', () => {
  it('inserts the 5 seed apps', async () => {
    assert.equal(await seedApps(), 5);
    const apps = await AppModel.find().sort({ order: 1 }).lean();
    assert.deepEqual(apps.map((app) => app.key), ['github', 'gitlab', 'jira', 'linear', 'slack']);
    const github = apps[0];
    assert.equal(github.status, 'available');
    assert.deepEqual(github.triggers.map((t) => t.key), ['pull_request.opened']);
    assert.deepEqual(github.actions.map((a) => a.key), ['pull_request.comment']);
  });

  it('is idempotent: running twice keeps 5 apps and the same ids, refreshing updatedAt', async () => {
    await seedApps();
    const first = await AppModel.find().sort({ order: 1 }).lean();
    await delay(10);
    await seedApps();
    const second = await AppModel.find().sort({ order: 1 }).lean();

    assert.equal(second.length, 5);
    second.forEach((app, i) => {
      assert.equal(app._id.toString(), first[i]._id.toString());
      assert.equal(app.createdAt.getTime(), first[i].createdAt.getTime());
      assert.ok(app.updatedAt.getTime() > first[i].updatedAt.getTime(), `${app.key} updatedAt refreshed`);
    });
  });

  it('updates an existing app to match the seed list', async () => {
    await seedApps();
    await AppModel.updateOne({ key: 'slack' }, { $set: { name: 'Old name', order: 99 } });
    await seedApps();
    const slack = await AppModel.findOne({ key: 'slack' }).lean();
    const seed = APPS_SEED.find((app) => app.key === 'slack');
    assert.equal(slack?.name, seed?.name);
    assert.equal(slack?.order, seed?.order);
  });
});
