import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** Runs expire 7 days after `createdAt` (TTL index). */
export const ZAP_RUN_TTL_SECONDS = 7 * 24 * 60 * 60;

const zapRunInputSchema = new Schema(
  {
    prNumber: { type: Number, required: true },
    prUrl: { type: String, required: true },
  },
  { _id: false },
);

const zapRunOutputSchema = new Schema(
  { commentUrl: { type: String, required: true } },
  { _id: false },
);

/** `zapRuns` collection: one document per Zap execution (Data-model.md → zapRuns). */
const zapRunSchema = new Schema(
  {
    zapId: { type: Schema.Types.ObjectId, ref: 'Zap', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // `X-GitHub-Delivery`. Inserting the run is the claim that stops a duplicate comment.
    deliveryId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'] as const,
      required: true,
      default: 'pending',
    },
    input: { type: zapRunInputSchema, required: true },
    output: { type: zapRunOutputSchema, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

zapRunSchema.index({ zapId: 1, createdAt: -1 });
zapRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: ZAP_RUN_TTL_SECONDS });

export type ZapRun = InferSchemaType<typeof zapRunSchema>;
export type ZapRunDocument = HydratedDocument<ZapRun>;

export const ZapRunModel = model('ZapRun', zapRunSchema);
