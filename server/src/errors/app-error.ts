import type { ApiErrorEnvelope, ErrorCode } from '@zaps/shared';

/**
 * Base class for every error that maps to a known envelope.
 * New error types extend it with a code from `shared/src/errors.ts`.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }

  toEnvelope(): ApiErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Sign in required') {
    super(401, 'UNAUTHENTICATED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Content-Type must be application/json') {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }
}
