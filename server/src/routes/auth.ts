import { Router } from 'express';
import passport from 'passport';
import { GITHUB_STRATEGY, useGithubStrategy } from '../auth/github-strategy.js';
import { authenticateCallback, redirectAfterSignIn, redirectOnSignInError } from '../auth/redirects.js';
import { logout } from '../auth/logout.js';
import { requireJson } from '../middleware/require-json.js';

// Mount point for `/auth` (F3). S2 appends `POST /auth/logout` (with `requireJson`) at the end,
// E1 adds the callback's failure redirect (`CLIENT_URL/login?error=oauth`).
export const authRouter = Router();

// Starts OAuth: 302 to GitHub with the scopes and a `state` stored in the session.
authRouter.get('/github', useGithubStrategy, passport.authenticate(GITHUB_STRATEGY));

// GitHub redirects here: passport checks `state`, exchanges the code, runs the verify
// callback (upsert user) and `req.login` (regenerates the session id). Any failure, denial
// or `state` mismatch redirects to `CLIENT_URL/login?error=oauth`.
authRouter.get(
  '/github/callback',
  useGithubStrategy,
  authenticateCallback,
  redirectAfterSignIn,
  redirectOnSignInError,
);

// S2: ends the session (logout, destroy, clear `zaps.sid`); `204` even without a session.
authRouter.post('/logout', requireJson, logout);
