import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { encryptedValueSchema } from './encrypted-value.js';

/** A trigger or action: `app` and `event` reference the catalog; `config` is validated in `/shared`. */
const zapStepSchema = new Schema(
  {
    app: { type: String, required: true },
    event: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false, minimize: false },
);

/** Set only while the Zap is enabled. `hookId` routes incoming deliveries (`X-GitHub-Hook-ID`). */
const zapWebhookSchema = new Schema(
  {
    hookId: { type: Number, required: true },
    // Webhook HMAC secret, encrypted. Never returned by the API or logged.
    secret: { type: encryptedValueSchema, required: true },
  },
  { _id: false },
);

/** `zaps` collection (Data-model.md → zaps). Every query is scoped by `userId`. */
const zapSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    appId: { type: Schema.Types.ObjectId, ref: 'App', required: true },
    name: { type: String, required: true, minlength: 1, maxlength: 100 },
    enabled: { type: Boolean, required: true, default: false },
    trigger: { type: zapStepSchema, required: true },
    action: { type: zapStepSchema, required: true },
    webhook: { type: zapWebhookSchema, default: null },
  },
  { timestamps: true },
);

zapSchema.index({ userId: 1, updatedAt: -1 });
zapSchema.index({ userId: 1, appId: 1, updatedAt: -1 });
// Filter on hookId's type, not on `webhook` existing: disabled Zaps store `webhook: null`,
// which `$exists` would still match, so two disabled Zaps would collide on `null`.
zapSchema.index(
  { 'webhook.hookId': 1 },
  { unique: true, partialFilterExpression: { 'webhook.hookId': { $type: 'number' } } },
);

export type Zap = InferSchemaType<typeof zapSchema>;
export type ZapDocument = HydratedDocument<Zap>;

export const ZapModel = model('Zap', zapSchema);
