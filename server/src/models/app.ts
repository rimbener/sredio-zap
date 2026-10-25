import type { AppEventDto, AppSeed } from '@zaps/shared';
import { model, Schema, type HydratedDocument } from 'mongoose';

/** An `apps` document: the seed fields from `/shared` plus timestamps. */
export type App = AppSeed & { createdAt: Date; updatedAt: Date };
export type AppDocument = HydratedDocument<App>;

const appEventSchema = new Schema<AppEventDto>(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false },
);

/** `apps` collection: the app picker catalog (Data-model.md → apps). Filled by `npm run seed`. */
const appSchema = new Schema<App>(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    status: { type: String, enum: ['available', 'coming_soon'], required: true },
    order: { type: Number, required: true },
    triggers: { type: [appEventSchema], default: [] },
    actions: { type: [appEventSchema], default: [] },
  },
  { timestamps: true },
);

export const AppModel = model<App>('App', appSchema);
