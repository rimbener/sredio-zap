import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ERROR_CODES, ErrorCode } from '@zaps/shared';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';
import { ERROR_MESSAGES, GENERIC_ERROR_MESSAGE, errorMessageFor } from './error-messages';
import { HANDLED_ERROR_CODES, ME_URL, httpErrorInterceptor } from './http-error.interceptor';
import { NotificationService } from './notification.service';

const ZAPS_URL = `${environment.apiUrl}/api/zaps`;

function envelope(code: ErrorCode, message = 'server message', details?: unknown) {
  return { error: { code, message, details } };
}

describe('httpErrorInterceptor', () => {
  let client: HttpClient;
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
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function failGet(body: string | object, status: number, context?: HttpContext): ApiError | undefined {
    let error: ApiError | undefined;
    client.get(ZAPS_URL, { context }).subscribe({ error: (e: ApiError) => (error = e) });
    http.expectOne(ZAPS_URL).flush(body, { status, statusText: 'Error' });
    return error;
  }

  it('sends every request with credentials', () => {
    client.post(ZAPS_URL, {}).subscribe();
    const req = http.expectOne(ZAPS_URL);
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('passes GET /api/me errors through untouched, with credentials and no snackbar', () => {
    let status: number | undefined;
    client.get(ME_URL).subscribe({ error: (e: { status: number }) => (status = e.status) });
    const req = http.expectOne(ME_URL);
    expect(req.request.withCredentials).toBeTrue();
    req.flush(envelope('INTERNAL_ERROR'), { status: 500, statusText: 'Error' });

    expect(status).toBe(500);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('parses the envelope into an ApiError and shows the mapped snackbar', () => {
    const error = failGet(envelope('REPO_NOT_ACCESSIBLE'), 422);

    expect(error).toEqual(jasmine.any(ApiError));
    expect(error?.status).toBe(422);
    expect(error?.code).toBe('REPO_NOT_ACCESSIBLE');
    expect(error?.message).toBe('server message');
    expect(notifications.show).toHaveBeenCalledOnceWith(ERROR_MESSAGES.REPO_NOT_ACCESSIBLE as string);
  });

  it('keeps details on the ApiError', () => {
    const details = { hookSettingsUrl: 'https://github.com/acme/api/settings/hooks/1' };
    const error = failGet(envelope('WEBHOOK_EXISTS', 'exists', details), 409);
    expect(error?.details).toEqual(details);
  });

  it('shows the server message for VALIDATION_ERROR', () => {
    failGet(envelope('VALIDATION_ERROR', 'Name is required'), 400);
    expect(notifications.show).toHaveBeenCalledOnceWith('Name is required');
  });

  it('shows no snackbar for UNAUTHENTICATED and GITHUB_AUTH_REQUIRED', () => {
    failGet(envelope('UNAUTHENTICATED'), 401);
    failGet(envelope('GITHUB_AUTH_REQUIRED'), 401);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('maps a network error to INTERNAL_ERROR with the generic text', () => {
    let error: ApiError | undefined;
    client.get(ZAPS_URL).subscribe({ error: (e: ApiError) => (error = e) });
    http.expectOne(ZAPS_URL).error(new ProgressEvent('error'), { status: 0 });

    expect(error?.code).toBe('INTERNAL_ERROR');
    expect(error?.status).toBe(0);
    expect(notifications.show).toHaveBeenCalledOnceWith(GENERIC_ERROR_MESSAGE);
  });

  it('maps a response without an envelope to INTERNAL_ERROR', () => {
    const error = failGet('<html>Bad gateway</html>', 502);
    expect(error?.code).toBe('INTERNAL_ERROR');
    expect(notifications.show).toHaveBeenCalledOnceWith(GENERIC_ERROR_MESSAGE);
  });

  it('skips the snackbar for codes listed in HANDLED_ERROR_CODES but still errors', () => {
    const context = new HttpContext().set(HANDLED_ERROR_CODES, ['VALIDATION_ERROR', 'WEBHOOK_EXISTS']);
    const error = failGet(envelope('WEBHOOK_EXISTS'), 409, context);

    expect(error?.code).toBe('WEBHOOK_EXISTS');
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('still shows the snackbar for codes not listed in HANDLED_ERROR_CODES', () => {
    const context = new HttpContext().set(HANDLED_ERROR_CODES, ['VALIDATION_ERROR']);
    failGet(envelope('GITHUB_ERROR'), 502, context);
    expect(notifications.show).toHaveBeenCalledOnceWith(ERROR_MESSAGES.GITHUB_ERROR as string);
  });
});

describe('errorMessageFor', () => {
  it('has a snackbar text for every code except the login redirects', () => {
    for (const code of ERROR_CODES) {
      const text = errorMessageFor(new ApiError(400, code, ''));
      if (code === 'UNAUTHENTICATED' || code === 'GITHUB_AUTH_REQUIRED') {
        expect(text).withContext(code).toBeNull();
      } else {
        expect(text).withContext(code).toBeTruthy();
      }
    }
  });

  it('uses the texts from Screens.md', () => {
    const text = (code: ErrorCode) => errorMessageFor(new ApiError(400, code, ''));
    expect(text('NOT_FOUND')).toBe('This Zap no longer exists');
    expect(text('APP_UNAVAILABLE')).toBe("This app isn't available yet.");
    expect(text('GITHUB_ERROR')).toBe("GitHub didn't respond as expected. Try again.");
    expect(text('PAYLOAD_TOO_LARGE')).toBe('This comment is too long to save. Try shortening it.');
    expect(text('INTERNAL_ERROR')).toBe('Something went wrong. Try again.');
  });
});
