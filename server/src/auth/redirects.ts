import type { ErrorRequestHandler, RequestHandler } from 'express';
import passport from 'passport';
import { getEnv } from '../env.js';
import { GITHUB_STRATEGY } from './github-strategy.js';

/** After a successful callback (`req.login` done by passport): back to the client's Zap list. */
export const redirectAfterSignIn: RequestHandler = (_req, res) => {
  res.redirect(`${getEnv().CLIENT_URL}/zaps`);
};

/** Where a failed sign-in lands; the login page shows "Sign-in failed. Please try again." */
export function signInFailedUrl(): string {
  return `${getEnv().CLIENT_URL}/login?error=oauth`;
}

/**
 * Runs the GitHub strategy on the callback. Denial (`error=access_denied`) and a missing or
 * mismatched `state` are passport failures → `signInFailedUrl()`. The URL is built per request
 * so env is read lazily, like the strategy itself.
 */
export const authenticateCallback: RequestHandler = (req, res, next) => {
  passport.authenticate(GITHUB_STRATEGY, { failureRedirect: signInFailedUrl() })(req, res, next);
};

/**
 * Any other callback error (another GitHub `?error=`, a failed code exchange or profile fetch,
 * a failed user upsert): the browser is mid-redirect, so it goes to the same login page
 * instead of getting a JSON envelope.
 */
export const redirectOnSignInError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error(err);
  }
  res.redirect(signInFailedUrl());
};
