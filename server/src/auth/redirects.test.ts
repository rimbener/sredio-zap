import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.js';
import { useTestDb } from '../test/db.js';
import { TEST_ENV } from '../test/env.js';

useTestDb();

const FAILED = `${TEST_ENV.CLIENT_URL}/login?error=oauth`;

describe('GET /auth/github/callback failures', () => {
  it('missing state (no OAuth started in this session) → 302 to /login?error=oauth', async () => {
    const res = await request(createApp()).get('/auth/github/callback?code=abc');

    assert.equal(res.status, 302);
    assert.equal(res.headers.location, FAILED);
  });

  it('mismatched state → 302 to /login?error=oauth', async () => {
    const agent = request.agent(createApp());
    const start = await agent.get('/auth/github');
    assert.equal(start.status, 302);

    const res = await agent.get('/auth/github/callback?code=abc&state=not-the-stored-state');

    assert.equal(res.status, 302);
    assert.equal(res.headers.location, FAILED);
    assert.equal(await UserModel.countDocuments(), 0);
  });

  it('denial (error=access_denied) → 302 to /login?error=oauth', async () => {
    const agent = request.agent(createApp());
    await agent.get('/auth/github');

    const res = await agent.get(
      '/auth/github/callback?error=access_denied&error_description=The+user+has+denied+your+application+access.',
    );

    assert.equal(res.status, 302);
    assert.equal(res.headers.location, FAILED);
  });

  it('any other GitHub error → 302 to /login?error=oauth, not a JSON envelope', async () => {
    const res = await request(createApp()).get(
      '/auth/github/callback?error=redirect_uri_mismatch&error_description=Bad+redirect',
    );

    assert.equal(res.status, 302);
    assert.equal(res.headers.location, FAILED);
  });
});
