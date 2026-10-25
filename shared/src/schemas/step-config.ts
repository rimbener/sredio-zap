import { z } from 'zod';

/** GitHub's comment length limit. Templates count it in JS `length` (UTF-16 units). */
export const COMMENT_BODY_MAX_LENGTH = 65536;

export const pullRequestOpenedConfigSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
});

export const pullRequestCommentConfigSchema = z.object({
  body: z.string().min(1).max(COMMENT_BODY_MAX_LENGTH),
});

export type PullRequestOpenedConfig = z.infer<typeof pullRequestOpenedConfigSchema>;
export type PullRequestCommentConfig = z.infer<typeof pullRequestCommentConfigSchema>;

export type StepKind = 'trigger' | 'action';

type ConfigRegistry = Readonly<Record<string, Readonly<Record<string, z.ZodTypeAny>>>>;

/** Config schema per step kind, then `app`, then `event` (Data-model.md → Trigger / action shape). */
export const STEP_CONFIG_SCHEMAS: Readonly<Record<StepKind, ConfigRegistry>> = {
  trigger: {
    github: { 'pull_request.opened': pullRequestOpenedConfigSchema },
  },
  action: {
    github: { 'pull_request.comment': pullRequestCommentConfigSchema },
  },
};

/** The config schema for a step, or `undefined` for an unknown `app + event` pair. */
export function getStepConfigSchema(kind: StepKind, app: string, event: string): z.ZodTypeAny | undefined {
  const registry = STEP_CONFIG_SCHEMAS[kind];
  const byEvent = Object.hasOwn(registry, app) ? registry[app] : undefined;
  if (!byEvent || !Object.hasOwn(byEvent, event)) return undefined;
  return byEvent[event];
}
