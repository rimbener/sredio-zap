/**
 * Template rendering for action string fields (Data-model.md → Field mapping).
 *
 * Placeholders are plain `{{token}}` substitution, with no expressions or logic.
 * The same function renders the real comment on the server and the builder preview.
 */

/** Token values keyed by token name without braces, e.g. `{ 'pr.title': 'Fix login redirect' }`. */
export type TokenValues = Record<string, string>;

const PLACEHOLDER = /\{\{([^{}]+)\}\}/g;

/**
 * Replaces every `{{token}}` in `template` with `values[token]`.
 * Placeholders without a value are left as they are (unknown tokens are rejected when the Zap is saved).
 */
export function renderTemplate(template: string, values: TokenValues): string {
  return template.replace(PLACEHOLDER, (match, token: string) =>
    Object.hasOwn(values, token) ? values[token] : match,
  );
}

/** Sample values for the builder preview (Screens.md → Action card). */
export const SAMPLE_TOKEN_VALUES: Readonly<TokenValues> = Object.freeze({
  'pr.number': '42',
  'pr.title': 'Fix login redirect',
  'pr.body': 'Redirects back to the original page after sign-in.',
  'pr.url': 'https://github.com/octocat/hello-world/pull/42',
  'pr.author': 'octocat',
  'repo.name': 'hello-world',
  'repo.fullName': 'octocat/hello-world',
});

/** The parts of a GitHub `pull_request` webhook payload the tokens read. */
export interface PullRequestPayload {
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    user: { login: string };
  };
  repository: {
    name: string;
    full_name: string;
  };
}

/** Maps a `pull_request` webhook payload to the values of the `github / pull_request.opened` tokens. */
export function buildTokenValues(payload: PullRequestPayload): TokenValues {
  const { pull_request: pr, repository: repo } = payload;
  return {
    'pr.number': String(pr.number),
    'pr.title': pr.title,
    'pr.body': pr.body ?? '',
    'pr.url': pr.html_url,
    'pr.author': pr.user.login,
    'repo.name': repo.name,
    'repo.fullName': repo.full_name,
  };
}
