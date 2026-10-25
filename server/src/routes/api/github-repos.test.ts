import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Octokit } from '@octokit/rest';
import type { RepoDto } from '@zaps/shared';
import request from 'supertest';
import { createApp } from '../../app.js';
import { encrypt } from '../../crypto/token.js';
import { getTokenEncryptionKey } from '../../env.js';
import { resetOctokitFactory, setOctokitFactory } from '../../github/octokit.js';
import { UserModel } from '../../models/user.js';
import { useTestDb } from '../../test/db.js';
import { githubRequestError } from '../../test/github-errors.js';
import { createTestUser } from '../../test/users.js';

useTestDb();

type FakeRepo = { owner: string; name: string; admin: boolean };

function ghRepo({ owner, name, admin }: FakeRepo) {
  return {
    name,
    full_name: `${owner}/${name}`,
    html_url: `https://github.com/${owner}/${name}`,
    owner: { login: owner },
    permissions: { admin, push: true, pull: true },
  };
}

/** A fake Octokit serving `pages` with GitHub-style `Link` headers; records each call's params. */
function fakeOctokit(pages: FakeRepo[][]) {
  const calls: Record<string, unknown>[] = [];
  const listForAuthenticatedUser = async (params: Record<string, unknown>) => {
    calls.push(params);
    const page = params.page as number;
    const link =
      page < pages.length
        ? `<https://api.github.com/user/repos?page=${page + 1}>; rel="next", <https://api.github.com/user/repos?page=${pages.length}>; rel="last"`
        : undefined;
    return { status: 200, headers: link ? { link } : {}, data: pages[page - 1].map(ghRepo) };
  };
  return { octokit: { rest: { repos: { listForAuthenticatedUser } } } as unknown as Octokit, calls };
}

async function userWithToken(token: string) {
  const user = await createTestUser();
  user.accessToken = encrypt(token, getTokenEncryptionKey()) as never;
  await user.save();
  return UserModel.findById(user._id).orFail();
}

describe('GET /api/github/repos', () => {
  afterEach(() => resetOctokitFactory());

  it('follows every page, drops non-admin repos and keeps GitHub order', async () => {
    const { octokit, calls } = fakeOctokit([
      [
        { owner: 'me', name: 'newest', admin: true },
        { owner: 'acme', name: 'read-only', admin: false },
      ],
      [
        { owner: 'acme', name: 'api', admin: true },
        { owner: 'me', name: 'oldest', admin: true },
      ],
    ]);
    const tokens: string[] = [];
    setOctokitFactory((token) => {
      tokens.push(token);
      return octokit;
    });
    const user = await userWithToken('gho_user_token');

    const res = await request(createApp({ authenticateAs: () => user })).get('/api/github/repos');

    assert.equal(res.status, 200);
    assert.deepEqual(tokens, ['gho_user_token']);
    assert.deepEqual(
      calls.map((c) => c.page),
      [1, 2],
    );
    assert.deepEqual(calls[0], {
      visibility: 'public',
      affiliation: 'owner,collaborator,organization_member',
      sort: 'pushed',
      per_page: 100,
      page: 1,
    });
    const repos = res.body as RepoDto[];
    assert.deepEqual(
      repos.map((r) => r.fullName),
      ['me/newest', 'acme/api', 'me/oldest'],
    );
    assert.deepEqual(repos[1], {
      owner: 'acme',
      repo: 'api',
      fullName: 'acme/api',
      htmlUrl: 'https://github.com/acme/api',
    });
  });

  it('returns [] when the user admins no public repo', async () => {
    setOctokitFactory(() => fakeOctokit([[{ owner: 'acme', name: 'x', admin: false }]]).octokit);
    const user = await userWithToken('gho_t');
    const res = await request(createApp({ authenticateAs: () => user })).get('/api/github/repos');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('GitHub errors: 401 → GITHUB_AUTH_REQUIRED; 403, 404, rate limit, 500 → 502 GITHUB_ERROR', async () => {
    const user = await userWithToken('gho_t');
    const cases: [Error, number, string][] = [
      [githubRequestError(401), 401, 'GITHUB_AUTH_REQUIRED'],
      [githubRequestError(403), 502, 'GITHUB_ERROR'],
      [githubRequestError(403, { 'retry-after': '60' }), 502, 'GITHUB_ERROR'],
      [githubRequestError(404), 502, 'GITHUB_ERROR'],
      [githubRequestError(500), 502, 'GITHUB_ERROR'],
    ];
    for (const [err, status, code] of cases) {
      const listForAuthenticatedUser = async () => {
        throw err;
      };
      setOctokitFactory(() => ({ rest: { repos: { listForAuthenticatedUser } } }) as unknown as Octokit);
      const res = await request(createApp({ authenticateAs: () => user })).get('/api/github/repos');
      assert.equal(res.status, status, `${err.message}`);
      assert.equal(res.body.error.code, code, `${err.message}`);
    }
  });

  it('signed out → 401 UNAUTHENTICATED', async () => {
    const res = await request(createApp()).get('/api/github/repos');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
  });
});
