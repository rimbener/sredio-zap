import type { Request, Response } from 'express';
import { SESSION_COOKIE_NAME } from '../app.js';

/**
 * Ends the current session (API.md → Conventions, Ending a session), waiting for each step:
 * `req.logout` (async in passport 0.7), then `req.session.destroy` (removes the store
 * document), then clears the `zaps.sid` cookie. The caller sends the response afterwards.
 * Safe without a session. Shared by `POST /auth/logout` (S2) and `GITHUB_AUTH_REQUIRED` (E2).
 */
export async function endSession(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.logout((err: unknown) => (err ? reject(err) : resolve()));
  });
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((err: unknown) => (err ? reject(err) : resolve()));
  });
  res.clearCookie(SESSION_COOKIE_NAME);
}
