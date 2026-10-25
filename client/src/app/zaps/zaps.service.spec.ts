import { HttpContext } from '@angular/common/http';
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

  it('get() GETs /api/zaps/:id', () => {
    const zap = makeZap();
    let result: ZapDto | undefined;
    service.get(zap.id).subscribe((value) => (result = value));

    const req = http.expectOne(`${environment.apiUrl}/api/zaps/${zap.id}`);
    expect(req.request.method).toBe('GET');
    req.flush(zap);
    expect(result).toEqual(zap);
  });

  it('update() PATCHes the changed fields to /api/zaps/:id', () => {
    const zap = makeZap({ name: 'Renamed' });
    let result: ZapDto | undefined;
    service.update(zap.id, { name: 'Renamed' }).subscribe((value) => (result = value));

    const req = http.expectOne(`${environment.apiUrl}/api/zaps/${zap.id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Renamed' });
    req.flush(zap);
    expect(result).toEqual(zap);
  });

  it('create() and update() send the given HttpContext', () => {
    const context = new HttpContext();
    const zap = makeZap();
    service.create({ appId: zap.appId, name: zap.name, trigger: zap.trigger, action: zap.action }, context).subscribe();
    service.update(zap.id, { name: 'Renamed' }, context).subscribe();

    expect(http.expectOne(`${environment.apiUrl}/api/zaps`).request.context).toBe(context);
    expect(http.expectOne(`${environment.apiUrl}/api/zaps/${zap.id}`).request.context).toBe(context);
  });
});
