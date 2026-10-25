import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { resetOctokitFactory, setOctokitFactory } from '../../../github/octokit.js';
import type { UserDocument } from '../../../models/user.js';
import { useTestDb } from '../../../test/db.js';
import { createTestUser } from '../../../test/users.js';

useTestDb();

/** E9: a mistyped id in a Zap path is a 404 `NOT_FOUND` on every route, never a 400 or 500. */
describe('invalid ObjectId in /api/zaps/:id paths', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;
  let githubCalls: number;

  beforeEach(async () => {
    user = await createTestUser();
    app = createApp({ authenticateAs: () => user });
    githubCalls = 0;
    setOctokitFactory(() => {
      githubCalls += 1;
      throw new Error('no GitHub call expected');
    });
  });

  afterEach(() => resetOctokitFactory());

  const cases: Array<[string, (agent: ReturnType<typeof request>) => request.Test]> = [
    ['GET /api/zaps/abc', (agent) => agent.get('/api/zaps/abc')],
    [
      'PATCH /api/zaps/abc',
      (agent) => agent.patch('/api/zaps/abc').set('Content-Type', 'application/json').send({ name: 'Renamed' }),
    ],
    ['DELETE /api/zaps/abc', (agent) => agent.delete('/api/zaps/abc')],
    [
      'POST /api/zaps/abc/enable',
      (agent) => agent.post('/api/zaps/abc/enable').set('Content-Type', 'application/json').send({}),
    ],
    [
      'POST /api/zaps/abc/disable',
      (agent) => agent.post('/api/zaps/abc/disable').set('Content-Type', 'application/json').send({}),
    ],
  ];

  for (const [name, send] of cases) {
    it(`${name} → 404 NOT_FOUND, no GitHub call`, async () => {
      const res = await send(request(app));
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
      assert.equal(githubCalls, 0);
    });
  }
});
