import type { AppDto } from '@zaps/shared';
import { Router } from 'express';
import type { Types } from 'mongoose';
import { AppModel, type App } from '../../models/app.js';

/** Maps an `apps` document to `AppDto` (exposes `id`, drops timestamps). */
export function toAppDto(app: App & { _id: Types.ObjectId }): AppDto {
  return {
    id: app._id.toString(),
    key: app.key,
    name: app.name,
    icon: app.icon,
    status: app.status,
    order: app.order,
    triggers: app.triggers.map(({ key, name, description }) => ({ key, name, description })),
    actions: app.actions.map(({ key, name, description }) => ({ key, name, description })),
  };
}

/** `GET /api/apps`: the catalog sorted by `order` (API.md → Apps). */
export const appsRouter = Router();

appsRouter.get('/', async (_req, res) => {
  const apps = await AppModel.find().sort({ order: 1 }).lean();
  res.json(apps.map(toAppDto));
});
