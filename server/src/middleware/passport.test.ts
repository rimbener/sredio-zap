import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useTestDb } from '../test/db.js';
import { createTestUser } from '../test/users.js';
import { configurePassport } from './passport.js';

useTestDb();

// passport runs the registered (de)serializers when called with a value instead of a function.
type Done = (err: unknown, value?: unknown) => void;
type Chain = {
  serializeUser(user: unknown, done: Done): void;
  deserializeUser(id: unknown, done: Done): void;
};

function run(fn: (done: Done) => void): Promise<unknown> {
  return new Promise((resolve, reject) => fn((err, value) => (err ? reject(err) : resolve(value))));
}

describe('passport session (de)serialization', () => {
  const passport = configurePassport() as unknown as Chain;

  it('serializes a user by _id and deserializes it back', async () => {
    const user = await createTestUser();
    const id = await run((done) => passport.serializeUser(user, done));
    assert.equal(id, user._id.toString());

    const restored = (await run((done) => passport.deserializeUser(id, done))) as typeof user;
    assert.equal(restored._id.toString(), user._id.toString());
    assert.equal(restored.login, user.login);
  });

  it('deserializes a deleted or invalid id to false (no user)', async () => {
    const user = await createTestUser();
    await user.deleteOne();
    assert.equal(await run((done) => passport.deserializeUser(user._id.toString(), done)), false);
    assert.equal(await run((done) => passport.deserializeUser('abc', done)), false);
  });
});
