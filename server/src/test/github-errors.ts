/**
 * A fake of Octokit's `RequestError` (status + `response.headers`), for tests that make the fake
 * Octokit throw (Tech-Stack.md → Testing approach: 401, 403 with rate-limit headers, 422, ...).
 */
export function githubRequestError(status: number, headers: Record<string, string> = {}): Error {
  return Object.assign(new Error(`GitHub ${status}`), {
    name: 'HttpError',
    status,
    response: { status, url: 'https://api.github.com/', headers, data: {} },
  });
}
