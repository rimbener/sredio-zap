import type { RequestHandler } from 'express';
import { UnauthenticatedError } from '../errors/app-error.js';

/** No or expired session → `401 UNAUTHENTICATED`. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.isAuthenticated()) {
    next(new UnauthenticatedError());
    return;
  }
  next();
};
