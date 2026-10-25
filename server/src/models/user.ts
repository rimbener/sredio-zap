import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { encryptedValueSchema } from './encrypted-value.js';

/** `users` collection (Data-model.md → users). Upserted by `githubId` on each sign-in (S1). */
const userSchema = new Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    login: { type: String, required: true },
    name: { type: String, default: null },
    avatarUrl: { type: String, required: true },
    // GitHub OAuth token, encrypted. Never returned by the API or logged.
    accessToken: { type: encryptedValueSchema, required: true },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);

declare global {
  namespace Express {
    // passport's `req.user` is the deserialized user document.
    interface User extends UserDocument {}
  }
}
