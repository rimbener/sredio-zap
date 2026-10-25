import { AppError } from '../errors/app-error.js';

/** GitHub rejected the stored token (revoked or expired). The session handling is E2's. */
export class GithubAuthRequiredError extends AppError {
  constructor(message = 'GitHub sign-in required') {
    super(401, 'GITHUB_AUTH_REQUIRED', message);
  }
}

/** The repo is missing, not public, not admin-able by the user, or blocked by its organization. */
export class RepoNotAccessibleError extends AppError {
  constructor(message = "Can't add a webhook to this repo") {
    super(422, 'REPO_NOT_ACCESSIBLE', message);
  }
}

/** Any other GitHub API failure, including rate limits. */
export class GithubError extends AppError {
  constructor(message = "GitHub didn't respond as expected") {
    super(502, 'GITHUB_ERROR', message);
  }
}

/** The parts of Octokit's `RequestError` the mapper reads (duck-typed, no extra dependency). */
type GithubRequestError = {
  status?: unknown;
  response?: { headers?: Record<string, unknown> };
};

export interface MapGithubErrorOptions {
  /**
   * `true` for calls on a specific repo (the create-webhook routine): a non-rate-limit `403`
   * or a `404` means `REPO_NOT_ACCESSIBLE`. `false` (e.g. the repos list): those are `GITHUB_ERROR`.
   */
  repoAccess: boolean;
}

/** GitHub reports secondary rate limits as `403` with `retry-after` or `x-ratelimit-remaining: 0`. */
function isRateLimited(headers: Record<string, unknown> | undefined): boolean {
  if (!headers) return false;
  return headers['retry-after'] !== undefined || String(headers['x-ratelimit-remaining']) === '0';
}

/**
 * Maps an error thrown by an Octokit call to the API error envelope (API.md → Errors,
 * Create-webhook routine step 4): `401` → `GITHUB_AUTH_REQUIRED`; rate-limit `403` →
 * `GITHUB_ERROR`; other `403` and `404` → `REPO_NOT_ACCESSIBLE` (repo calls only);
 * anything else, including network failures → `GITHUB_ERROR`.
 */
export function mapGithubError(err: unknown, { repoAccess }: MapGithubErrorOptions): AppError {
  if (err instanceof AppError) return err;

  const { status, response } = (typeof err === 'object' && err !== null ? err : {}) as GithubRequestError;

  if (status === 401) return new GithubAuthRequiredError();
  if (status === 403 && isRateLimited(response?.headers)) return new GithubError('GitHub rate limit reached');
  if (repoAccess && (status === 403 || status === 404)) return new RepoNotAccessibleError();
  return new GithubError();
}
