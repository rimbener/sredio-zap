import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { EnvError, envSchema, getTokenEncryptionKey, loadEnv } from './env.js';
import { TEST_ENV } from './test/env.js';

function without(key: keyof typeof TEST_ENV): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...TEST_ENV };
  delete env[key];
  return env;
}

describe('loadEnv', () => {
  it('accepts a complete env and coerces PORT', () => {
    const env = loadEnv({ ...TEST_ENV });
    assert.equal(env.PORT, 3000);
    assert.equal(env.CLIENT_URL, TEST_ENV.CLIENT_URL);
    assert.equal(getTokenEncryptionKey(env).length, 32);
  });

  for (const key of Object.keys(envSchema.shape).filter((k) => k !== 'NODE_ENV')) {
    it(`throws when ${key} is missing`, () => {
      assert.throws(
        () => loadEnv(without(key as keyof typeof TEST_ENV)),
        (err: unknown) => err instanceof EnvError && err.message.includes(key),
      );
    });
  }

  it('throws when TOKEN_ENCRYPTION_KEY decodes to the wrong length', () => {
    for (const bytes of [16, 31, 33, 64]) {
      assert.throws(
        () => loadEnv({ ...TEST_ENV, TOKEN_ENCRYPTION_KEY: randomBytes(bytes).toString('base64') }),
        /TOKEN_ENCRYPTION_KEY/,
      );
    }
  });

  it('throws when TOKEN_ENCRYPTION_KEY is not base64', () => {
    assert.throws(
      () => loadEnv({ ...TEST_ENV, TOKEN_ENCRYPTION_KEY: 'replace-with-32-byte-base64-key' }),
      /TOKEN_ENCRYPTION_KEY/,
    );
    // 64 hex chars are valid-looking base64 but decode to 48 bytes.
    assert.throws(
      () => loadEnv({ ...TEST_ENV, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex') }),
      /TOKEN_ENCRYPTION_KEY/,
    );
  });

  it('throws on invalid values', () => {
    assert.throws(() => loadEnv({ ...TEST_ENV, PORT: 'abc' }), /PORT/);
    assert.throws(() => loadEnv({ ...TEST_ENV, CLIENT_URL: 'not a url' }), /CLIENT_URL/);
    assert.throws(() => loadEnv({ ...TEST_ENV, MONGODB_URI: 'http://x' }), /MONGODB_URI/);
    assert.throws(() => loadEnv({ ...TEST_ENV, SESSION_SECRET: '' }), /SESSION_SECRET/);
  });

  it('lists every invalid var at once', () => {
    const env = without('SESSION_SECRET');
    delete env.GITHUB_CLIENT_ID;
    assert.throws(() => loadEnv(env), /SESSION_SECRET[\s\S]*GITHUB_CLIENT_ID/);
  });
});
