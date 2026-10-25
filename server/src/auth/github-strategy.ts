import type { RequestHandler } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy, type Profile, type StrategyOptions } from 'passport-github2';
import { encrypt } from '../crypto/token.js';
import { getEnv, getTokenEncryptionKey, type Env } from '../env.js';
import { UserModel, type UserDocument } from '../models/user.js';

export const GITHUB_STRATEGY = 'github';

/** OAuth scopes (API.md → Auth): public repos plus repo webhooks. */
export const GITHUB_SCOPES = ['public_repo', 'admin:repo_hook'];

/** passport-github2 keeps the raw API user in `_json` (missing from the typings). */
type GithubProfile = Profile & { _json?: { avatar_url?: string } };

/**
 * Upserts the user by `githubId` (Data-model.md → users): refreshes `login`, `name`,
 * `avatarUrl` and the encrypted token on every sign-in.
 */
export async function upsertGithubUser(
  profile: Profile,
  accessToken: string,
  key: Buffer = getTokenEncryptionKey(),
): Promise<UserDocument> {
  const json = (profile as GithubProfile)._json ?? {};
  const user = await UserModel.findOneAndUpdate(
    { githubId: Number(profile.id) },
    {
      login: profile.username,
      name: profile.displayName || null,
      avatarUrl: json.avatar_url,
      accessToken: encrypt(accessToken, key),
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return user;
}

/** Passport verify callback: upsert, then hand the user to `req.login` (via `passport.authenticate`). */
export function verifyGithubUser(
  accessToken: string,
  _refreshToken: string,
  profile: Profile,
  done: (err: unknown, user?: UserDocument | false) => void,
): void {
  upsertGithubUser(profile, accessToken).then(
    (user) => done(null, user),
    (err: unknown) => done(err),
  );
}

export function createGithubStrategy(env: Env = getEnv()): GitHubStrategy {
  const options = {
    clientID: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    callbackURL: env.GITHUB_CALLBACK_URL,
    scope: GITHUB_SCOPES,
    scopeSeparator: ' ',
    // Random `state` stored in the session, checked on the callback (OAuth CSRF protection).
    // passport-oauth2 takes `true`; the passport-github2 typings only allow a string.
    state: true as unknown as string,
  } satisfies StrategyOptions;
  return new GitHubStrategy(options, verifyGithubUser);
}

let registered = false;

/**
 * Registers the GitHub strategy on the global passport instance on first use, so env is
 * read when a request arrives rather than at import time.
 */
export const useGithubStrategy: RequestHandler = (_req, _res, next) => {
  if (!registered) {
    passport.use(GITHUB_STRATEGY, createGithubStrategy());
    registered = true;
  }
  next();
};
