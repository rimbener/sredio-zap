import { HttpErrorResponse } from '@angular/common/http';
import { ErrorCode, isErrorCode } from '@zaps/shared';

/**
 * A failed API call, parsed from the `{ error: { code, message, details? } }` envelope.
 * Network errors and responses without a valid envelope become `INTERNAL_ERROR`
 * (Screens.md → Error handling shows the same text for both).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static from(response: HttpErrorResponse): ApiError {
    const body: unknown = response.error;
    const error = isRecord(body) && isRecord(body['error']) ? body['error'] : undefined;
    if (error && isErrorCode(error['code'])) {
      const message = typeof error['message'] === 'string' ? error['message'] : '';
      return new ApiError(response.status, error['code'], message, error['details']);
    }
    return new ApiError(response.status, 'INTERNAL_ERROR', response.message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
