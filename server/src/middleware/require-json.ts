import type { RequestHandler } from 'express';
import { UnsupportedMediaTypeError } from '../errors/app-error.js';

/**
 * Strict `Content-Type: application/json` check (`req.is`), otherwise `415`.
 * A request without a body fails too. Keep it strict: it is part of the CSRF protection
 * (API.md → Conventions), so a "simple" form or text/plain POST never reaches a handler.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!req.is('application/json')) {
    next(new UnsupportedMediaTypeError());
    return;
  }
  next();
};

const WRITE_METHODS = new Set(['POST', 'PATCH']);

/** `requireJson` on POST/PATCH only; DELETE has no body and isn't checked. */
export const requireJsonOnWrites: RequestHandler = (req, res, next) => {
  if (WRITE_METHODS.has(req.method)) {
    requireJson(req, res, next);
    return;
  }
  next();
};
