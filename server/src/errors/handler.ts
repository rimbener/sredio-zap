import type { ApiErrorEnvelope, ValidationIssue } from '@zaps/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
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
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  let status: number;
  let body: ApiErrorEnvelope;

  if (err instanceof AppError) {
    status = err.status;
    body = err.toEnvelope();
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
