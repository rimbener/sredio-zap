import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundError } from '../errors/app-error.js';
import { githubRequestError } from '../test/github-errors.js';
import { mapGithubError } from './errors.js';

const repoCall = { repoAccess: true };
const listCall = { repoAccess: false };

function codeOf(err: unknown, options = repoCall): [number, string] {
  const mapped = mapGithubError(err, options);
  return [mapped.status, mapped.code];
}

describe('mapGithubError', () => {
  it('401 → 401 GITHUB_AUTH_REQUIRED', () => {
    assert.deepEqual(codeOf(githubRequestError(401)), [401, 'GITHUB_AUTH_REQUIRED']);
    assert.deepEqual(codeOf(githubRequestError(401), listCall), [401, 'GITHUB_AUTH_REQUIRED']);
  });

  it('403 with retry-after → 502 GITHUB_ERROR (secondary rate limit)', () => {
    assert.deepEqual(codeOf(githubRequestError(403, { 'retry-after': '60' })), [502, 'GITHUB_ERROR']);
  });

  it('403 with x-ratelimit-remaining: 0 → 502 GITHUB_ERROR', () => {
    const err = githubRequestError(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-limit': '5000' });
    assert.deepEqual(codeOf(err), [502, 'GITHUB_ERROR']);
  });

  it('plain 403 (remaining > 0) → 422 REPO_NOT_ACCESSIBLE on a repo call', () => {
    const err = githubRequestError(403, { 'x-ratelimit-remaining': '4999' });
    assert.deepEqual(codeOf(err), [422, 'REPO_NOT_ACCESSIBLE']);
  });

  it('404 → 422 REPO_NOT_ACCESSIBLE on a repo call', () => {
    assert.deepEqual(codeOf(githubRequestError(404)), [422, 'REPO_NOT_ACCESSIBLE']);
  });

  it('403 and 404 → 502 GITHUB_ERROR on the repos list', () => {
    assert.deepEqual(codeOf(githubRequestError(403), listCall), [502, 'GITHUB_ERROR']);
    assert.deepEqual(codeOf(githubRequestError(404), listCall), [502, 'GITHUB_ERROR']);
  });

  it('500 and 422 → 502 GITHUB_ERROR', () => {
    assert.deepEqual(codeOf(githubRequestError(500)), [502, 'GITHUB_ERROR']);
    assert.deepEqual(codeOf(githubRequestError(422)), [502, 'GITHUB_ERROR']);
  });

  it('network failure (no status) → 502 GITHUB_ERROR', () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: new Error('ECONNRESET') });
    assert.deepEqual(codeOf(err), [502, 'GITHUB_ERROR']);
    assert.deepEqual(codeOf('not an error'), [502, 'GITHUB_ERROR']);
  });

  it('passes an AppError through unchanged', () => {
    const err = new NotFoundError();
    assert.equal(mapGithubError(err, repoCall), err);
  });

  it('the envelope never carries GitHub internals', () => {
    const err = githubRequestError(500);
    err.message = 'token gho_secret leaked';
    assert.ok(!JSON.stringify(mapGithubError(err, repoCall).toEnvelope()).includes('gho_secret'));
  });
});
