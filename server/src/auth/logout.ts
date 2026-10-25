import type { RequestHandler } from 'express';
import { endSession } from './end-session.js';

/** `POST /auth/logout`: ends the session and answers `204`, also when there was none. */
export const logout: RequestHandler = async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
};
