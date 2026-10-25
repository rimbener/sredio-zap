import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import type { ZapDto } from '@zaps/shared';
import { environment } from '../../environments/environment';
import { ApiError } from '../core/api-error';
import { httpErrorInterceptor } from '../core/http-error.interceptor';
import { NotificationService } from '../core/notification.service';
import { makeZap } from './testing/zap-fixtures';
import { WEBHOOK_EXISTS_TOGGLE_MESSAGE, WebhookExistsDialogComponent } from './webhook-exists-dialog.component';
import { ZapToggleService } from './zap-toggle.service';

describe('ZapToggleService', () => {
  let service: ZapToggleService;
  let http: HttpTestingController;
  let dialog: jasmine.SpyObj<MatDialog>;
  let notifications: { show: jasmine.Spy };
  const base = `${environment.apiUrl}/api/zaps`;

  beforeEach(() => {
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    notifications = { show: jasmine.createSpy('show') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notifications },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    service = TestBed.inject(ZapToggleService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('POSTs {} to /enable and emits the updated Zap', () => {
    const zap = makeZap();
    let result: ZapDto | undefined;
    service.setEnabled(zap, true).subscribe((value) => (result = value));

    const req = http.expectOne(`${base}/${zap.id}/enable`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...zap, enabled: true });
    expect(result?.enabled).toBeTrue();
  });

  it('POSTs {} to /disable', () => {
    const zap = makeZap({ enabled: true });
    service.setEnabled(zap, false).subscribe();
    const req = http.expectOne(`${base}/${zap.id}/disable`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...zap, enabled: false });
  });

  it('errors with an ApiError', () => {
    const zap = makeZap();
    let error: unknown;
    service.setEnabled(zap, true).subscribe({ error: (e) => (error = e) });
    http
      .expectOne(`${base}/${zap.id}/enable`)
      .flush({ error: { code: 'NOT_FOUND', message: 'Zap not found' } }, { status: 404, statusText: 'Not Found' });
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });

  it('WEBHOOK_EXISTS on enable: no snackbar, opens the dialog with the toggle text, still errors', () => {
    const zap = makeZap();
    const hookSettingsUrl = 'https://github.com/acme/api/settings/hooks/987';
    let error: unknown;
    service.setEnabled(zap, true).subscribe({ error: (e) => (error = e) });
    http
      .expectOne(`${base}/${zap.id}/enable`)
      .flush(
        { error: { code: 'WEBHOOK_EXISTS', message: 'exists', details: { hookSettingsUrl } } },
        { status: 409, statusText: 'Conflict' },
      );

    expect(notifications.show).not.toHaveBeenCalled();
    expect(dialog.open).toHaveBeenCalledOnceWith(WebhookExistsDialogComponent, {
      data: { message: WEBHOOK_EXISTS_TOGGLE_MESSAGE, hookSettingsUrl },
    });
    // The caller's toggle reverts to off on the error.
    expect((error as ApiError).code).toBe('WEBHOOK_EXISTS');
  });

  it('other errors keep the snackbar and open no dialog', () => {
    const zap = makeZap();
    service.setEnabled(zap, true).subscribe({ error: () => undefined });
    http
      .expectOne(`${base}/${zap.id}/enable`)
      .flush({ error: { code: 'GITHUB_ERROR', message: 'x' } }, { status: 502, statusText: 'Bad Gateway' });
    expect(notifications.show).toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
