import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM output, all fields base64 (Data-model.md → Shared type `EncryptedValue`).
 *
 * Defined locally until F1 lands `EncryptedValue` in `@zaps/shared`; then this
 * becomes a re-export of the shared type.
 */
export interface EncryptedValue {
  iv: string;
  authTag: string;
  ciphertext: string;
}

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Decodes the base64 `TOKEN_ENCRYPTION_KEY` and checks it is exactly 32 bytes.
 * Throws otherwise, so env validation (F3) can refuse to start.
 */
export function parseEncryptionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== KEY_BYTES || key.toString('base64') !== base64Key) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded`);
  }
  return key;
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Encryption key must be ${KEY_BYTES} bytes`);
  }
}

/** Encrypts `plain` with a fresh random 12-byte IV. */
export function encrypt(plain: string, key: Buffer): EncryptedValue {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

/** Decrypts a value produced by `encrypt`. Throws if the key is wrong or any field was tampered with. */
export function decrypt(value: EncryptedValue, key: Buffer): string {
  assertKey(key);
  const iv = Buffer.from(value.iv, 'base64');
  const authTag = Buffer.from(value.authTag, 'base64');
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Invalid encrypted value');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
