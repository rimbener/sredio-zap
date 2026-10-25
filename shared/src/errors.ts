// Error codes and the error envelope shared by server and client (API.md → Errors).

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'GITHUB_AUTH_REQUIRED',
  'NOT_FOUND',
  'WEBHOOK_EXISTS',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'APP_UNAVAILABLE',
  'REPO_NOT_ACCESSIBLE',
  'GITHUB_ERROR',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** One zod issue as sent in `details` for `VALIDATION_ERROR`. */
export type ValidationIssue = {
  path: (string | number)[];
  message: string;
};

/** `details` for `WEBHOOK_EXISTS`. */
export type WebhookExistsDetails = {
  hookSettingsUrl: string;
};

export type ApiErrorBody = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

/** Every error response: `{ error: { code, message, details? } }`. */
export type ApiErrorEnvelope = {
  error: ApiErrorBody;
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
