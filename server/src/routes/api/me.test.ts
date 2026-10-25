import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app.js';
import { useTestDb } from '../../test/db.js';
import { createTestUser } from '../../test/users.js';

useTestDb();

describe('GET /api/me', () => {
  it('signed in → UserDto without the token or githubId', async () => {
    const user = await createTestUser({ login: 'octocat', name: null });
    const res = await request(createApp({ authenticateAs: () => user })).get('/api/me');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      id: user._id.toString(),
      login: 'octocat',
      name: null,
      avatarUrl: user.avatarUrl,
    });
  });

  it('signed out → 401 UNAUTHENTICATED', async () => {
    const res = await request(createApp()).get('/api/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });
});
