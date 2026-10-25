import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../app.js';
import type { UserDocument } from '../models/user.js';
import { useTestDb } from '../test/db.js';
import { createTestUser } from '../test/users.js';

useTestDb();

const SIGN_IN_HEADER = 'x-test-sign-in';

function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

/** The `zaps.sid=...` pair from a response's `Set-Cookie`. */
function sessionCookie(res: request.Response): string {
  const cookie = setCookies(res).find((c) => c.startsWith('zaps.sid='));
  assert.ok(cookie, 'expected a zaps.sid cookie');
  return cookie.split(';')[0]!;
}

function countSessions(): Promise<number> {
  return mongoose.connection.collection('sessions').countDocuments();
}

describe('POST /auth/logout', () => {
  let user: UserDocument;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    user = await createTestUser();
    // A real session: a request with the sign-in header calls `req.login`, which stores
    // `passport.user` in the Mongo session store and sets `zaps.sid`. Every other request is
    // authenticated only by that cookie (passport's deserializeUser).
    app = createApp({
      authenticateAs: async (req) => {
        if (req.get(SIGN_IN_HEADER)) {
          await new Promise<void>((resolve, reject) => req.login(user, (err) => (err ? reject(err) : resolve())));
        }
        return null;
      },
    });
  });

  async function signIn(): Promise<string> {
    const res = await request(app).get('/api/me').set(SIGN_IN_HEADER, '1');
    assert.equal(res.status, 200);
    const cookie = sessionCookie(res);
    const me = await request(app).get('/api/me').set('Cookie', cookie);
    assert.equal(me.status, 200, 'the cookie alone authenticates');
    return cookie;
  }

  it('ends the session: 204, clears zaps.sid, deletes the session document, old cookie → 401', async () => {
    const cookie = await signIn();
    assert.equal(await countSessions(), 1);

    const res = await request(app).post('/auth/logout').set('Cookie', cookie).send({});

    assert.equal(res.status, 204);
    assert.equal(res.text, '');
    const cleared = setCookies(res).find((c) => c.startsWith('zaps.sid='));
    assert.ok(cleared, 'expected zaps.sid to be cleared');
    assert.match(cleared, /^zaps\.sid=;/);
    assert.match(cleared, /Expires=Thu, 01 Jan 1970/);
    assert.equal(await countSessions(), 0);

    const me = await request(app).get('/api/me').set('Cookie', cookie);
    assert.equal(me.status, 401);
    assert.equal(me.body.error.code, 'UNAUTHENTICATED');
  });

  it('without a session → 204 (safe to repeat)', async () => {
    const none = await request(createApp()).post('/auth/logout').send({});
    assert.equal(none.status, 204);

    const cookie = await signIn();
    await request(app).post('/auth/logout').set('Cookie', cookie).send({});
    const again = await request(app).post('/auth/logout').set('Cookie', cookie).send({});
    assert.equal(again.status, 204);
  });

  it('text/plain body → 415 and the session survives', async () => {
    const cookie = await signIn();

    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain')
      .send('{}');

    assert.equal(res.status, 415);
    assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
    assert.equal(await countSessions(), 1);
    const me = await request(app).get('/api/me').set('Cookie', cookie);
    assert.equal(me.status, 200);
  });

  it('no body → 415', async () => {
    const res = await request(createApp()).post('/auth/logout');
    assert.equal(res.status, 415);
  });
});
