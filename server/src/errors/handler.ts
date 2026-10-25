import type { ApiErrorEnvelope, ValidationIssue } from '@zaps/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { SESSION_COOKIE_NAME } from '../app.js';
import { endSession } from '../auth/end-session.js';
import { AppError, NotFoundError } from './app-error.js';

/** body-parser errors carry a `type` and an HTTP `status`. */
type BodyParserError = Error & { type?: unknown; status?: unknown };

function isBodyParserError(err: unknown, type: string): err is BodyParserError {
  return err instanceof Error && (err as BodyParserError).type === type;
}

function toIssues(err: ZodError): ValidationIssue[] {
  return err.issues.map((issue) => ({ path: issue.path, message: issue.message }));
}

/** Unknown routes → `404 NOT_FOUND` envelope. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route not found'));
};

/**
 * Maps errors to the envelope (API.md → Errors):
 * zod → 400 VALIDATION_ERROR, AppError → its own envelope,
 * body-parser over-limit → 413, anything else → 500 without internals.
 * `GITHUB_AUTH_REQUIRED` first ends the session with `endSession` (E2), so the user is
 * really signed out before the `401` is sent.
 */
export const errorHandler: ErrorRequestHandler = async (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  let status: number;
  let body: ApiErrorEnvelope;

  if (err instanceof AppError) {
    status = err.status;
    body = err.toEnvelope();
    if (err.code === 'GITHUB_AUTH_REQUIRED') {
      try {
        await endSession(req, res);
      } catch (sessionErr) {
        // Still answer 401 GITHUB_AUTH_REQUIRED: the client signs the user out either way.
        if (process.env.NODE_ENV !== 'test') console.error(sessionErr);
        res.clearCookie(SESSION_COOKIE_NAME);
      }
    }
  } else if (err instanceof ZodError) {
    status = 400;
    body = { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: toIssues(err) } };
  } else if (isBodyParserError(err, 'entity.too.large')) {
    status = 413;
    body = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } };
  } else if (isBodyParserError(err, 'entity.parse.failed')) {
    status = 400;
    body = { error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' } };
  } else {
    if (process.env.NODE_ENV !== 'test') {
      console.error(err);
    }
    status = 500;
    body = { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };
  }

  res.status(status).json(body);
};
