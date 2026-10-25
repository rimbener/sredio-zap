import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { UserDto } from '@zaps/shared';
import { authGuard, guestGuard } from './auth.guards';
import { AuthService } from './auth.service';

const user: UserDto = { id: 'u1', login: 'octocat', name: null, avatarUrl: 'https://example.com/a.png' };

describe('auth guards', () => {
  let loadUser: jasmine.Spy<() => Observable<UserDto | null>>;
  let router: Router;

  beforeEach(() => {
    loadUser = jasmine.createSpy('loadUser');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { loadUser } }],
    });
    router = TestBed.inject(Router);
  });

  function run(guard: typeof authGuard): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  describe('authGuard', () => {
    it('allows a signed-in user', async () => {
      loadUser.and.returnValue(of(user));
      expect(await run(authGuard)).toBeTrue();
    });

    it('redirects a signed-out user to /login', async () => {
      loadUser.and.returnValue(of(null));
      const result = await run(authGuard);
      expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    });

    it('redirects to /login when /api/me fails', async () => {
      loadUser.and.returnValue(throwError(() => new Error('down')));
      const result = await run(authGuard);
      expect(router.serializeUrl(result as UrlTree)).toBe('/login');
    });
  });

  describe('guestGuard', () => {
    it('allows a signed-out user', async () => {
      loadUser.and.returnValue(of(null));
      expect(await run(guestGuard)).toBeTrue();
    });

    it('redirects a signed-in user to /zaps', async () => {
      loadUser.and.returnValue(of(user));
      const result = await run(guestGuard);
      expect(router.serializeUrl(result as UrlTree)).toBe('/zaps');
    });

    it('allows the login page when /api/me fails', async () => {
      loadUser.and.returnValue(throwError(() => new Error('down')));
      expect(await run(guestGuard)).toBeTrue();
    });
  });
});
