import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { verifySignature } from './verify-signature.js';

const SECRET = 'a'.repeat(64);
const BODY = Buffer.from('{"action":"opened"}');
const sign = (body: Buffer, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifySignature', () => {
  it('accepts the HMAC-SHA256 of the raw body', () => {
    assert.equal(verifySignature(sign(BODY), SECRET, BODY), true);
  });

  it('rejects a different secret or body', () => {
    assert.equal(verifySignature(sign(BODY, 'b'.repeat(64)), SECRET, BODY), false);
    assert.equal(verifySignature(sign(BODY), SECRET, Buffer.from('{"action":"closed"}')), false);
  });

  it('rejects a missing or malformed header', () => {
    for (const header of [undefined, '', 'sha1=abc', sign(BODY).replace('sha256=', ''), sign(BODY).toUpperCase()]) {
      assert.equal(verifySignature(header, SECRET, BODY), false);
    }
  });

  it('rejects a wrong-length digest without throwing', () => {
    const good = sign(BODY);
    for (const header of [good.slice(0, -2), `${good}00`, 'sha256=']) {
      assert.doesNotThrow(() => verifySignature(header, SECRET, BODY));
      assert.equal(verifySignature(header, SECRET, BODY), false);
    }
  });
});
