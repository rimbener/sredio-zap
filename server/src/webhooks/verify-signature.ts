import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_HEADER = /^sha256=([0-9a-f]{64})$/;

/**
 * Checks GitHub's `X-Hub-Signature-256` against `HMAC-SHA256(secret, rawBody)` (API.md → Webhook receiver).
 * The header must be `sha256=` + 64 hex chars. Lengths are compared before `timingSafeEqual`,
 * so a wrong-length value returns `false` instead of throwing. Never weaken this check.
 */
export function verifySignature(header: string | undefined, secret: string, rawBody: Buffer): boolean {
  const match = typeof header === 'string' ? SIGNATURE_HEADER.exec(header) : null;
  if (!match) return false;
  const received = Buffer.from(match[1], 'hex');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}
