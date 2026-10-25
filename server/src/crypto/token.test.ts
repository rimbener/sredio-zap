import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { decrypt, encrypt, parseEncryptionKey, type EncryptedValue } from './token.js';

const key = randomBytes(32);

/** Flips one bit of a base64 field. */
function tamper(field: string): string {
  const bytes = Buffer.from(field, 'base64');
  bytes[0] ^= 0x01;
  return bytes.toString('base64');
}

describe('token encryption', () => {
  it('round-trips a value, including non-ASCII', () => {
    for (const plain of ['gho_abc123', '', 'ñandú ⚡ 🚀']) {
      assert.equal(decrypt(encrypt(plain, key), key), plain);
    }
  });

  it('produces base64 fields with a 12-byte IV', () => {
    const value = encrypt('secret', key);
    assert.equal(Buffer.from(value.iv, 'base64').length, 12);
    assert.equal(Buffer.from(value.authTag, 'base64').length, 16);
    assert.deepEqual(Object.keys(value).sort(), ['authTag', 'ciphertext', 'iv']);
  });

  it('uses a fresh IV, so two encryptions of the same value differ', () => {
    const a = encrypt('same', key);
    const b = encrypt('same', key);
    assert.notEqual(a.iv, b.iv);
    assert.notEqual(a.ciphertext, b.ciphertext);
  });

  it('throws on tampered ciphertext', () => {
    const value = encrypt('gho_token', key);
    assert.throws(() => decrypt({ ...value, ciphertext: tamper(value.ciphertext) }, key));
  });

  it('throws on a tampered authTag', () => {
    const value = encrypt('gho_token', key);
    assert.throws(() => decrypt({ ...value, authTag: tamper(value.authTag) }, key));
  });

  it('throws on a tampered or truncated IV / authTag', () => {
    const value: EncryptedValue = encrypt('gho_token', key);
    assert.throws(() => decrypt({ ...value, iv: tamper(value.iv) }, key));
    assert.throws(() => decrypt({ ...value, authTag: value.authTag.slice(0, 8) }, key));
  });

  it('throws with the wrong key', () => {
    const value = encrypt('gho_token', key);
    assert.throws(() => decrypt(value, randomBytes(32)));
  });

  it('rejects keys that are not 32 bytes', () => {
    assert.throws(() => encrypt('x', randomBytes(16)));
  });
});

describe('parseEncryptionKey', () => {
  it('accepts a base64 32-byte key', () => {
    const base64 = randomBytes(32).toString('base64');
    assert.equal(parseEncryptionKey(base64).toString('base64'), base64);
  });

  it('rejects wrong lengths and non-base64 input', () => {
    assert.throws(() => parseEncryptionKey(randomBytes(16).toString('base64')));
    assert.throws(() => parseEncryptionKey(''));
    assert.throws(() => parseEncryptionKey('not base64 at all!'));
  });
});
