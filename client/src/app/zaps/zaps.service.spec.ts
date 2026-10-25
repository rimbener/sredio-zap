import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { CreateZapInput, ZapDto } from '@zaps/shared';
import { environment } from '../../environments/environment';
import { makeZap } from './testing/zap-fixtures';
import { ZapsService } from './zaps.service';

describe('ZapsService', () => {
  let service: ZapsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(ZapsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() GETs /api/zaps', () => {
    const zaps = [makeZap()];
    let result: ZapDto[] | undefined;
    service.list().subscribe((value) => (result = value));

    const req = http.expectOne(`${environment.apiUrl}/api/zaps`);
    expect(req.request.method).toBe('GET');
    req.flush(zaps);
    expect(result).toEqual(zaps);
  });

  it('create() POSTs the body to /api/zaps', () => {
    const created = makeZap();
    const input: CreateZapInput = {
      appId: created.appId,
      name: created.name,
      trigger: created.trigger,
      action: created.action,
    };
    let result: ZapDto | undefined;
    service.create(input).subscribe((zap) => (result = zap));

    const req = http.expectOne(`${environment.apiUrl}/api/zaps`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush(created);
    expect(result).toEqual(created);
  });

  it('delete() DELETEs /api/zaps/:id', () => {
    let done = false;
    service.delete('abc123').subscribe({ complete: () => (done = true) });

    const req = http.expectOne(`${environment.apiUrl}/api/zaps/abc123`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBeTrue();
  });
});
