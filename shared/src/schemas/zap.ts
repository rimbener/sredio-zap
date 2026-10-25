import { z } from 'zod';
import { extractTokens, formatToken, getTriggerTokens } from '../tokens.js';
import { objectIdSchema } from './object-id.js';
import { getStepConfigSchema, type StepKind } from './step-config.js';

export const ZAP_NAME_MAX_LENGTH = 100;

/** Shape of a trigger or action. Its config is checked against the registry by `zapSchema`. */
export const zapStepSchema = z.object({
  app: z.string().min(1),
  event: z.string().min(1),
  config: z.record(z.unknown()),
});

const zapShape = {
  appId: objectIdSchema,
  name: z.string().min(1).max(ZAP_NAME_MAX_LENGTH),
  trigger: zapStepSchema,
  action: zapStepSchema,
};

const zapObjectSchema = z.object(zapShape);

type ZapStepInput = z.infer<typeof zapStepSchema>;

/** Validates `step.config` by `app + event`, replacing it with the parsed config. */
function refineStep(kind: StepKind, step: ZapStepInput, ctx: z.RefinementCtx): boolean {
  const schema = getStepConfigSchema(kind, step.app, step.event);
  if (!schema) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [kind, 'event'],
      message: `Unknown ${kind} ${step.app} / ${step.event}`,
    });
    return false;
  }
  const result = schema.safeParse(step.config);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ ...issue, path: [kind, 'config', ...issue.path] });
    }
    return false;
  }
  step.config = result.data;
  return true;
}

function refineZap(zap: z.infer<typeof zapObjectSchema>, ctx: z.RefinementCtx): void {
  const triggerOk = refineStep('trigger', zap.trigger, ctx);
  const actionOk = refineStep('action', zap.action, ctx);
  if (!triggerOk || !actionOk) return;

  const known = new Set(getTriggerTokens(zap.trigger.app, zap.trigger.event).map((t) => t.key));
  for (const [field, value] of Object.entries(zap.action.config)) {
    if (typeof value !== 'string') continue;
    for (const token of extractTokens(value)) {
      if (!known.has(token)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['action', 'config', field],
          message: `Unknown field ${formatToken(token)}`,
        });
      }
    }
  }
}

/**
 * A whole Zap: shape, step configs by `app + event` (unknown pair rejected), name 1–100, and
 * every `{{token}}` in action string fields from the trigger's token list. The
 * `appId` ↔ `trigger.app` check needs the database, so the server does it.
 */
export const zapSchema = zapObjectSchema.superRefine(refineZap);

/** Body of `POST /api/zaps`. */
export const createZapSchema = zapSchema;

/**
 * Body of `PATCH /api/zaps/:id`: any of the fields, shape only. A sent step replaces the
 * whole step; the server then checks the merged Zap with `validateZap`.
 */
export const patchZapSchema = zapObjectSchema.partial();

export type ZapInput = z.infer<typeof zapSchema>;
export type CreateZapInput = z.infer<typeof createZapSchema>;
export type PatchZapInput = z.infer<typeof patchZapSchema>;

/**
 * Validates a merged Zap (stored fields with a PATCH body applied at the top level).
 * Throws a `ZodError` on failure; returns the parsed Zap with configs stripped to known keys.
 */
export function validateZap(merged: unknown): ZapInput {
  return zapSchema.parse(merged);
}
