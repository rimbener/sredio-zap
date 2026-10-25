import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AppDto } from '@zaps/shared';
import { environment } from '../../environments/environment';
import { AppsService } from './apps.service';

const APPS: AppDto[] = [
  {
    id: '0123456789abcdef01234567',
    key: 'github',
    name: 'GitHub',
    icon: 'assets/apps/github.svg',
    status: 'available',
    order: 1,
    triggers: [],
    actions: [],
  },
];

describe('AppsService', () => {
  let service: AppsService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/api/apps`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AppsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches the apps once and caches them for later subscribers', () => {
    const results: AppDto[][] = [];
    service.getApps().subscribe((apps) => results.push(apps));
    service.getApps().subscribe((apps) => results.push(apps));

    http.expectOne(url).flush(APPS);
    service.getApps().subscribe((apps) => results.push(apps));

    http.expectNone(url);
    expect(results).toEqual([APPS, APPS, APPS]);
  });

  it('does not cache a failed request', () => {
    service.getApps().subscribe({ error: () => undefined });
    http.expectOne(url).flush(null, { status: 500, statusText: 'Server Error' });

    const results: AppDto[][] = [];
    service.getApps().subscribe((apps) => results.push(apps));
    http.expectOne(url).flush(APPS);
    expect(results).toEqual([APPS]);
  });
});
