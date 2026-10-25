import type { ZapDto, ZapStep } from '@zaps/shared';
import type { Types } from 'mongoose';

/** The fields `toZapDto` reads; a hydrated `ZapDocument` or a lean Zap both fit. */
export type ZapLike = {
  _id: Types.ObjectId;
  appId: Types.ObjectId;
  name: string;
  enabled: boolean;
  trigger: ZapStep;
  action: ZapStep;
  createdAt: Date;
  updatedAt: Date;
};

function toStep(step: ZapStep): ZapStep {
  return { app: step.app, event: step.event, config: { ...step.config } };
}

/** Maps a Zap to its API shape: exposes `id`, never `userId` or `webhook`. */
export function toZapDto(zap: ZapLike): ZapDto {
  return {
    id: zap._id.toString(),
    appId: zap.appId.toString(),
    name: zap.name,
    enabled: zap.enabled,
    trigger: toStep(zap.trigger),
    action: toStep(zap.action),
    createdAt: zap.createdAt.toISOString(),
    updatedAt: zap.updatedAt.toISOString(),
  };
}
