import { ErrorCode } from '@zaps/shared';
import { ApiError } from './api-error';

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Try again.';

/**
 * Snackbar text per error code (Screens.md → Error handling).
 * - A function builds the text from the error (the server's message).
 * - `null` means no snackbar: those codes send the user to login instead (E1, E2).
 *
 * Call sites that show their own UI for a code (builder field errors, the
 * `WEBHOOK_EXISTS` dialog, the builder's "Zap not found" state) opt out with
 * `HANDLED_ERROR_CODES`, so their entries here are only fallbacks.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string | ((error: ApiError) => string) | null> = {
  UNAUTHENTICATED: null,
  GITHUB_AUTH_REQUIRED: null,
  VALIDATION_ERROR: (error) => error.message || GENERIC_ERROR_MESSAGE,
  NOT_FOUND: 'This Zap no longer exists',
  APP_UNAVAILABLE: "This app isn't available yet.",
  WEBHOOK_EXISTS: (error) => error.message || GENERIC_ERROR_MESSAGE,
  REPO_NOT_ACCESSIBLE:
    "Can't add a webhook to this repo. Check it's public, you're an admin, and (for organization repos) that the organization allows this app.",
  GITHUB_ERROR: "GitHub didn't respond as expected. Try again.",
  PAYLOAD_TOO_LARGE: 'This comment is too long to save. Try shortening it.',
  UNSUPPORTED_MEDIA_TYPE: GENERIC_ERROR_MESSAGE,
  INTERNAL_ERROR: GENERIC_ERROR_MESSAGE,
};

/** The snackbar text for an error, or `null` when no snackbar is shown. */
export function errorMessageFor(error: ApiError): string | null {
  const entry = ERROR_MESSAGES[error.code];
  return typeof entry === 'function' ? entry(error) : entry;
}
