import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ErrorCode } from '@zaps/shared';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';
import { errorMessageFor } from './error-messages';
import { NotificationService } from './notification.service';

/**
 * Codes a call site handles itself: the interceptor shows no snackbar for them
 * and just passes the `ApiError` on, e.g.
 * `{ context: new HttpContext().set(HANDLED_ERROR_CODES, ['VALIDATION_ERROR', 'WEBHOOK_EXISTS']) }`.
 * (`UNAUTHENTICATED` and `GITHUB_AUTH_REQUIRED` will always redirect, even if listed: E1, E2.)
 */
export const HANDLED_ERROR_CODES = new HttpContextToken<ErrorCode[]>(() => []);

export const ME_URL = `${environment.apiUrl}/api/me`;

/** `GET /api/me` is handled by `AuthService`: a `401` there means signed out, not an error. */
export function isMeRequest(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url === ME_URL;
}

/**
 * Sends every request with credentials, turns error responses into an `ApiError`
 * and shows the snackbar for its code (Screens.md → Error handling).
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const request = req.clone({ withCredentials: true });
  if (isMeRequest(request)) {
    return next(request);
  }
  const notifications = inject(NotificationService);
  return next(request).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }
      const apiError = ApiError.from(err);
      if (!request.context.get(HANDLED_ERROR_CODES).includes(apiError.code)) {
        const message = errorMessageFor(apiError);
        if (message) {
          notifications.show(message);
        }
      }
      return throwError(() => apiError);
    }),
  );
};
