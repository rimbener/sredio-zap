import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppDto } from '@zaps/shared';
import request from 'supertest';
import { createApp } from '../../app.js';
import { seedApps } from '../../scripts/seed-apps.js';
import { useTestDb } from '../../test/db.js';
import { createTestUser } from '../../test/users.js';

useTestDb();

describe('GET /api/apps', () => {
  it('signed in → 5 apps sorted by order, as AppDto', async () => {
    await seedApps();
    const user = await createTestUser();
    const res = await request(createApp({ authenticateAs: () => user })).get('/api/apps');

    assert.equal(res.status, 200);
    const apps = res.body as AppDto[];
    assert.deepEqual(apps.map((app) => app.order), [1, 2, 3, 4, 5]);
    assert.deepEqual(apps.map((app) => app.key), ['github', 'gitlab', 'jira', 'linear', 'slack']);
    assert.deepEqual(Object.keys(apps[0]).sort(), [
      'actions', 'icon', 'id', 'key', 'name', 'order', 'status', 'triggers',
    ]);
    assert.match(apps[0].id, /^[0-9a-f]{24}$/);
    assert.deepEqual(apps[0].triggers, [
      {
        key: 'pull_request.opened',
        name: 'Pull request opened',
        description: 'Triggers when a pull request is opened in a repository.',
      },
    ]);
  });

  it('signed out → 401 UNAUTHENTICATED', async () => {
    const res = await request(createApp()).get('/api/apps');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });
});
