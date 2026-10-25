import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** Signed-in users only; everyone else goes to `/login`. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const toLogin = router.createUrlTree(['/login']);
  return inject(AuthService)
    .loadUser()
    .pipe(
      map((user) => (user ? true : toLogin)),
      catchError(() => of(toLogin)),
    );
};

/** Signed-out users only; a signed-in user goes to `/zaps`. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .loadUser()
    .pipe(
      map((user) => (user ? router.createUrlTree(['/zaps']) : true)),
      catchError(() => of(true)),
    );
};
