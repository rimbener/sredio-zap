import type { RequestHandler } from 'express';
import { getEnv } from '../env.js';

/** After a successful callback (`req.login` done by passport): back to the client's Zap list. */
export const redirectAfterSignIn: RequestHandler = (_req, res) => {
  res.redirect(`${getEnv().CLIENT_URL}/zaps`);
};
