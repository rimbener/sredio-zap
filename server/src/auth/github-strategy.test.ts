import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Profile } from 'passport-github2';
import request from 'supertest';
import { createApp } from '../app.js';
import { decrypt } from '../crypto/token.js';
import { getTokenEncryptionKey, loadEnv } from '../env.js';
import { UserModel, type UserDocument } from '../models/user.js';
import { useTestDb } from '../test/db.js';
import { TEST_ENV } from '../test/env.js';
import { verifyGithubUser } from './github-strategy.js';

useTestDb();

function fakeProfile(overrides: { login?: string; name?: string | null } = {}): Profile {
  return {
    provider: 'github',
    id: '583231',
    username: overrides.login ?? 'octocat',
    displayName: overrides.name === undefined ? 'The Octocat' : (overrides.name as string),
    profileUrl: 'https://github.com/octocat',
    _json: { avatar_url: 'https://avatars.githubusercontent.com/u/583231' },
  } as unknown as Profile;
}

function verify(profile: Profile, token: string): Promise<UserDocument> {
  return new Promise((resolve, reject) => {
    verifyGithubUser(token, '', profile, (err, user) => (err ? reject(err) : resolve(user as UserDocument)));
  });
}

describe('GitHub strategy verify callback', () => {
  it('creates the user from the profile with the token encrypted', async () => {
    const user = await verify(fakeProfile(), 'gho_first');

    assert.equal(user.githubId, 583231);
    assert.equal(user.login, 'octocat');
    assert.equal(user.name, 'The Octocat');
    assert.equal(user.avatarUrl, 'https://avatars.githubusercontent.com/u/583231');

    const stored = await UserModel.findById(user._id).lean();
    assert.ok(stored);
    assert.notEqual(stored.accessToken.ciphertext, 'gho_first');
    assert.ok(!JSON.stringify(stored).includes('gho_first'), 'plain token stored');
    assert.equal(decrypt(stored.accessToken, getTokenEncryptionKey()), 'gho_first');
  });

  it('upserts by githubId: a second sign-in updates login, name and token', async () => {
    const first = await verify(fakeProfile(), 'gho_first');
    const second = await verify(fakeProfile({ login: 'octocat-renamed', name: null }), 'gho_second');

    assert.equal(second._id.toString(), first._id.toString());
    assert.equal(await UserModel.countDocuments(), 1);
    const stored = await UserModel.findById(first._id).lean();
    assert.equal(stored?.login, 'octocat-renamed');
    assert.equal(stored?.name, null);
    assert.equal(decrypt(stored!.accessToken, getTokenEncryptionKey()), 'gho_second');
  });
});

describe('GET /auth/github', () => {
  it('302 to GitHub authorize with both scopes and a state', async () => {
    const res = await request(createApp()).get('/auth/github');

    assert.equal(res.status, 302);
    const location = new URL(res.headers.location as string);
    assert.equal(`${location.origin}${location.pathname}`, 'https://github.com/login/oauth/authorize');
    assert.equal(location.searchParams.get('scope'), 'public_repo admin:repo_hook');
    assert.equal(location.searchParams.get('client_id'), TEST_ENV.GITHUB_CLIENT_ID);
    assert.equal(location.searchParams.get('redirect_uri'), TEST_ENV.GITHUB_CALLBACK_URL);
    assert.match(location.searchParams.get('state') ?? '', /^.{16,}$/);
    // The state lives in the session, so the response sets the session cookie.
    assert.ok(String(res.headers['set-cookie']).includes('zaps.sid='));
    assert.doesNotMatch(String(res.headers['set-cookie']), /;\s*Secure/i);
  });

  it('HTTPS callback URL → Secure cookie behind a TLS-terminating proxy', async () => {
    const env = loadEnv({ ...TEST_ENV, GITHUB_CALLBACK_URL: 'https://zaps.example.com/auth/github/callback' });
    const res = await request(createApp({ env })).get('/auth/github').set('X-Forwarded-Proto', 'https');

    assert.equal(res.status, 302);
    assert.match(String(res.headers['set-cookie']), /zaps\.sid=.*;\s*Secure/i);
  });
});
