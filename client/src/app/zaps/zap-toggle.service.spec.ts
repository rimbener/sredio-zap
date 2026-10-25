import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ZapDto } from '@zaps/shared';
import { environment } from '../../environments/environment';
import { ApiError } from '../core/api-error';
import { httpErrorInterceptor } from '../core/http-error.interceptor';
import { NotificationService } from '../core/notification.service';
import { makeZap } from './testing/zap-fixtures';
import { ZapToggleService } from './zap-toggle.service';

describe('ZapToggleService', () => {
  let service: ZapToggleService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/api/zaps`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: { show: jasmine.createSpy('show') } },
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
});
