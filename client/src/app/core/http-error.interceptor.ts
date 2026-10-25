import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ErrorCode } from '@zaps/shared';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';
import { AuthService } from './auth.service';
import { errorMessageFor } from './error-messages';
import { NotificationService } from './notification.service';

/**
 * Codes a call site handles itself: the interceptor shows no snackbar for them
 * and just passes the `ApiError` on, e.g.
 * `{ context: new HttpContext().set(HANDLED_ERROR_CODES, ['VALIDATION_ERROR', 'WEBHOOK_EXISTS']) }`.
 * (`UNAUTHENTICATED` and `GITHUB_AUTH_REQUIRED` always redirect, even if listed.)
 */
export const HANDLED_ERROR_CODES = new HttpContextToken<ErrorCode[]>(() => []);

export const ME_URL = `${environment.apiUrl}/api/me`;

/** `GET /api/me` is handled by `AuthService`: a `401` there means signed out, not an error. */
export function isMeRequest(req: HttpRequest<unknown>): boolean {
  return req.method === 'GET' && req.url === ME_URL;
}

/**
 * Sends every request with credentials, turns error responses into an `ApiError`
 * and shows the snackbar for its code, or sends the user to login
 * (Screens.md → Error handling).
 */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const request = req.clone({ withCredentials: true });
  if (isMeRequest(request)) {
    return next(request);
  }
  const notifications = inject(NotificationService);
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(request).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }
      const apiError = ApiError.from(err);
      if (apiError.code === 'UNAUTHENTICATED') {
        // Expired or missing session: back to login, always (even if the call site listed it).
        // `authRedirect` lets the unsaved-changes guard (E10) pass without asking.
        auth.setSignedOut();
        void router.navigate(['/login'], { state: { authRedirect: true } });
      } else if (!request.context.get(HANDLED_ERROR_CODES).includes(apiError.code)) {
        const message = errorMessageFor(apiError);
        if (message) {
          notifications.show(message);
        }
      }
      return throwError(() => apiError);
    }),
  );
};
