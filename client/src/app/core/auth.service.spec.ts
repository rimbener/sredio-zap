import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UserDto } from '@zaps/shared';
import { AuthService, AuthState, LOGOUT_URL } from './auth.service';
import { GENERIC_ERROR_MESSAGE } from './error-messages';
import { ME_URL, httpErrorInterceptor } from './http-error.interceptor';
import { NotificationService } from './notification.service';

const user: UserDto = { id: 'u1', login: 'octocat', name: 'The Octocat', avatarUrl: 'https://example.com/a.png' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let notifications: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['show']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notifications },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts unknown', () => {
    let state: AuthState = null;
    auth.user$.subscribe((s) => (state = s));
    expect(state).toBeUndefined();
  });

  it('sends one GET /api/me for many subscribers and caches the user', () => {
    const results: (UserDto | null)[] = [];
    auth.loadUser().subscribe((u) => results.push(u));
    auth.loadUser().subscribe((u) => results.push(u));

    const req = http.expectOne(ME_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(user);

    auth.loadUser().subscribe((u) => results.push(u));
    http.expectNone(ME_URL);
    expect(results).toEqual([user, user, user]);

    let state: AuthState;
    auth.user$.subscribe((s) => (state = s));
    expect(state!).toEqual(user);
  });

  it('caches a 401 as null without a snackbar', () => {
    let result: UserDto | null | undefined;
    auth.loadUser().subscribe((u) => (result = u));
    http
      .expectOne(ME_URL)
      .flush({ error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }, { status: 401, statusText: 'Unauthorized' });

    expect(result).toBeNull();
    auth.loadUser().subscribe();
    http.expectNone(ME_URL);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('does not cache other failures and retries on the next call', () => {
    let failed = false;
    auth.loadUser().subscribe({ error: () => (failed = true) });
    http.expectOne(ME_URL).flush(null, { status: 500, statusText: 'Server Error' });
    expect(failed).toBeTrue();
    expect(notifications.show).toHaveBeenCalledOnceWith(GENERIC_ERROR_MESSAGE);

    let result: UserDto | null | undefined;
    auth.loadUser().subscribe((u) => (result = u));
    http.expectOne(ME_URL).flush(user);
    expect(result).toEqual(user);
  });

  it('setSignedOut() sets the state to null', () => {
    auth.loadUser().subscribe();
    http.expectOne(ME_URL).flush(user);

    auth.setSignedOut();

    let result: UserDto | null | undefined;
    auth.loadUser().subscribe((u) => (result = u));
    http.expectNone(ME_URL);
    expect(result).toBeNull();
  });

  describe('logout()', () => {
    beforeEach(() => {
      auth.loadUser().subscribe();
      http.expectOne(ME_URL).flush(user);
    });

    it('POSTs {} with credentials to /auth/logout, then sets the state to null', () => {
      let done = false;
      auth.logout().subscribe(() => (done = true));

      const req = http.expectOne(LOGOUT_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      expect(req.request.withCredentials).toBeTrue();
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(done).toBeTrue();
      let state: AuthState;
      auth.user$.subscribe((s) => (state = s));
      expect(state).toBeNull();
    });

    it('keeps the user and errors out when the request fails', () => {
      let failed = false;
      auth.logout().subscribe({ error: () => (failed = true) });
      http.expectOne(LOGOUT_URL).flush(null, { status: 500, statusText: 'Server Error' });

      expect(failed).toBeTrue();
      expect(notifications.show).toHaveBeenCalledOnceWith(GENERIC_ERROR_MESSAGE);
      let state: AuthState;
      auth.user$.subscribe((s) => (state = s));
      expect(state).toEqual(user);
    });
  });
});
