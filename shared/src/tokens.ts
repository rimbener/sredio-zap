/** A `{{token}}` a trigger exposes to action fields, with its label for the Insert field menu. */
export type TokenDef = {
  /** Token name without braces, e.g. `pr.author`. */
  key: string;
  /** Display label, e.g. `PR author`. */
  label: string;
};

/** Tokens for `github / pull_request.opened` (Data-model.md → Field mapping). */
export const PULL_REQUEST_OPENED_TOKENS: readonly TokenDef[] = [
  { key: 'pr.number', label: 'PR number' },
  { key: 'pr.title', label: 'PR title' },
  { key: 'pr.body', label: 'PR description' },
  { key: 'pr.url', label: 'PR URL' },
  { key: 'pr.author', label: 'PR author' },
  { key: 'repo.name', label: 'Repo name' },
  { key: 'repo.fullName', label: 'Repo full name' },
];

/** Trigger tokens keyed by `app`, then `event`. */
export const TRIGGER_TOKENS: Readonly<Record<string, Readonly<Record<string, readonly TokenDef[]>>>> = {
  github: {
    'pull_request.opened': PULL_REQUEST_OPENED_TOKENS,
  },
};

/** Tokens a trigger exposes; an empty list for an unknown `app + event`. */
export function getTriggerTokens(app: string, event: string): readonly TokenDef[] {
  const byEvent = Object.hasOwn(TRIGGER_TOKENS, app) ? TRIGGER_TOKENS[app] : undefined;
  if (!byEvent || !Object.hasOwn(byEvent, event)) return [];
  return byEvent[event];
}

/** `{{key}}`, as written in a template. */
export function formatToken(key: string): string {
  return `{{${key}}}`;
}

/**
 * Names of every `{{name}}` placeholder in a template, unique, in order of first appearance.
 * The name is returned exactly as written (no trimming), because placeholders are plain
 * string substitution: `{{ pr.title }}` is the token ` pr.title `, not `pr.title`.
 * Unbalanced braces (`{{pr.title}`, `{pr.title}}`) are not placeholders.
 */
export function extractTokens(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(/\{\{([^{}]*)\}\}/g)) {
    found.add(match[1]);
  }
  return [...found];
}
