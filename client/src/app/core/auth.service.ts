import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, of, shareReplay, tap, throwError } from 'rxjs';
import { UserDto } from '@zaps/shared';
import { GENERIC_ERROR_MESSAGE } from './error-messages';
import { ME_URL } from './http-error.interceptor';
import { NotificationService } from './notification.service';

/** `undefined` = not loaded yet, `null` = known signed out, otherwise the signed-in user. */
export type AuthState = UserDto | null | undefined;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly state = new BehaviorSubject<AuthState>(undefined);
  private pending?: Observable<UserDto | null>;

  /** The current auth state; starts as `undefined` until `loadUser()` resolves. */
  readonly user$: Observable<AuthState> = this.state.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Resolves the auth state, calling `GET /api/me` at most once: concurrent
   * callers share one request and the result is cached. A `401` is cached as
   * `null` (signed out). Any other failure isn't cached, so the next call
   * retries; it shows the generic snackbar and errors out.
   */
  loadUser(): Observable<UserDto | null> {
    const current = this.state.value;
    if (current !== undefined) {
      return of(current);
    }
    this.pending ??= this.http.get<UserDto>(ME_URL).pipe(
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          return of(null);
        }
        this.notifications.show(GENERIC_ERROR_MESSAGE);
        return throwError(() => err);
      }),
      tap((user) => this.state.next(user)),
      finalize(() => (this.pending = undefined)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.pending;
  }

  /** Marks the user as signed out (sign out, expired session). */
  setSignedOut(): void {
    this.state.next(null);
  }
}
