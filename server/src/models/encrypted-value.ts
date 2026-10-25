import { Schema } from 'mongoose';

// TODO(F1): replace this local type with `EncryptedValue` from `@zaps/shared` once F1 lands
// (`import type { EncryptedValue } from '@zaps/shared'`); the shape is identical.
/** AES-256-GCM output, all base64 strings (Data-model.md → Shared type `EncryptedValue`). */
export type EncryptedValue = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

/** Mongoose subdocument schema for an `EncryptedValue` (users.accessToken, zaps.webhook.secret). */
export const encryptedValueSchema = new Schema<EncryptedValue>(
  {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false },
);
