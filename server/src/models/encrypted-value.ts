import type { EncryptedValue } from '@zaps/shared';
import { Schema } from 'mongoose';

export type { EncryptedValue };

/** Mongoose subdocument schema for an `EncryptedValue` (users.accessToken, zaps.webhook.secret). */
export const encryptedValueSchema = new Schema<EncryptedValue>(
  {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false },
);
