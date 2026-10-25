import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { useTestDb } from './test/db.js';
import { createApp } from './app.js';
import type { UserDocument } from './models/user.js';
import { TEST_ENV } from './test/env.js';
import { createTestUser } from './test/users.js';

useTestDb();

describe('createApp', () => {
  let user: UserDocument;

  beforeEach(async () => {
    user = await createTestUser();
  });

  const signedIn = () => createApp({ authenticateAs: () => user });

  describe('requireAuth', () => {
    it('GET /api/anything without a session → 401 UNAUTHENTICATED', async () => {
      const res = await request(createApp()).get('/api/anything');
      assert.equal(res.status, 401);
      assert.deepEqual(res.body, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } });
    });

    it('authenticateAs returning null → 401', async () => {
      const res = await request(createApp({ authenticateAs: () => null })).get('/api/anything');
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    });

    it('runs before requireJson: signed-out text/plain POST → 401, not 415', async () => {
      const res = await request(createApp()).post('/api/anything').set('Content-Type', 'text/plain').send('x');
      assert.equal(res.status, 401);
    });

    it('signed in → passes through to the routes (unknown route → 404)', async () => {
      const res = await request(signedIn()).get('/api/anything');
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });
  });

  describe('requireJson', () => {
    for (const method of ['post', 'patch'] as const) {
      it(`${method.toUpperCase()} with text/plain → 415 UNSUPPORTED_MEDIA_TYPE`, async () => {
        const res = await request(signedIn())[method]('/api/anything').set('Content-Type', 'text/plain').send('{}');
        assert.equal(res.status, 415);
        assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
      });

      it(`${method.toUpperCase()} with a form body → 415`, async () => {
        const res = await request(signedIn())[method]('/api/anything').type('form').send({ a: '1' });
        assert.equal(res.status, 415);
      });

      it(`${method.toUpperCase()} with no body → 415`, async () => {
        const res = await request(signedIn())[method]('/api/anything');
        assert.equal(res.status, 415);
      });

      it(`${method.toUpperCase()} with JSON → passes (reaches the 404 handler)`, async () => {
        const res = await request(signedIn())[method]('/api/anything').send({ a: 1 });
        assert.equal(res.status, 404);
        assert.equal(res.body.error.code, 'NOT_FOUND');
      });
    }

    it('DELETE without a body passes (reaches the 404 handler)', async () => {
      const res = await request(signedIn()).delete('/api/anything');
      assert.equal(res.status, 404);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });
  });

  describe('errors', () => {
    it('unknown route → 404 NOT_FOUND envelope', async () => {
      const res = await request(createApp()).get('/does-not-exist');
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
    });

    it('JSON body over 100 KB → 413 PAYLOAD_TOO_LARGE envelope', async () => {
      const res = await request(signedIn())
        .post('/api/anything')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ body: 'x'.repeat(101 * 1024) }));
      assert.equal(res.status, 413);
      assert.deepEqual(res.body, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    });
  });

  describe('CORS', () => {
    it('preflight from CLIENT_URL is allowed with credentials', async () => {
      const res = await request(createApp())
        .options('/api/zaps')
        .set('Origin', TEST_ENV.CLIENT_URL)
        .set('Access-Control-Request-Method', 'PATCH')
        .set('Access-Control-Request-Headers', 'content-type');
      assert.equal(res.status, 204);
      assert.equal(res.headers['access-control-allow-origin'], TEST_ENV.CLIENT_URL);
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });

    it('preflight from another origin is not allowed', async () => {
      const res = await request(createApp())
        .options('/api/zaps')
        .set('Origin', 'http://localhost:5555')
        .set('Access-Control-Request-Method', 'PATCH');
      // Only CLIENT_URL is ever echoed, so the browser blocks any other origin.
      assert.notEqual(res.headers['access-control-allow-origin'], 'http://localhost:5555');
      assert.equal(res.headers['access-control-allow-origin'], TEST_ENV.CLIENT_URL);
    });
  });

  describe('session and headers', () => {
    it('sets helmet security headers', async () => {
      const res = await request(createApp()).get('/does-not-exist');
      assert.equal(res.headers['x-content-type-options'], 'nosniff');
      assert.ok(res.headers['content-security-policy']);
    });

    it('does not create a session cookie for anonymous requests', async () => {
      const res = await request(createApp()).get('/api/anything');
      assert.equal(res.headers['set-cookie'], undefined);
    });
  });
});
