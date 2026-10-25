import { HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type { AppDto } from '@zaps/shared';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AppsService } from '../../core/apps.service';
import { GithubService } from '../../core/github.service';
import { HANDLED_ERROR_CODES } from '../../core/http-error.interceptor';
import { NotificationService } from '../../core/notification.service';
import { GITHUB_APP } from '../testing/zap-fixtures';
import { ZapsService } from '../zaps.service';
import { ZapBuilderComponent } from './zap-builder.component';

const GITLAB_APP: AppDto = {
  ...GITHUB_APP,
  id: '0123456789abcdef01234568',
  key: 'gitlab',
  name: 'GitLab',
  status: 'coming_soon',
  order: 2,
  triggers: [],
  actions: [],
};

/** E9: bad builder links (Screens.md → Routes). */
describe('ZapBuilderComponent (not found and bad links)', () => {
  let zaps: jasmine.SpyObj<ZapsService>;
  let notifications: jasmine.SpyObj<NotificationService>;
  let getRepos: jasmine.Spy;

  function render(params: { id?: string; appId?: string }) {
    zaps = jasmine.createSpyObj<ZapsService>('ZapsService', ['get', 'create', 'update']);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['show']);
    getRepos = jasmine.createSpy('getRepos').and.returnValue(of([]));
    const paramMap = convertToParamMap(params.id ? { id: params.id } : {});
    const queryParamMap = convertToParamMap(params.appId ? { appId: params.appId } : {});
    TestBed.configureTestingModule({
      imports: [ZapBuilderComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap, queryParamMap } } },
        { provide: AppsService, useValue: { getApps: () => of([GITHUB_APP, GITLAB_APP]) } },
        { provide: GithubService, useValue: { getRepos } },
        { provide: ZapsService, useValue: zaps },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    return { navigate };
  }

  function create() {
    const fixture = TestBed.createComponent(ZapBuilderComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  describe('edit mode', () => {
    it('a 404 shows "Zap not found" with a link to /zaps, and opts out of the snackbar', () => {
      render({ id: 'abc' });
      zaps.get.and.returnValue(throwError(() => new ApiError(404, 'NOT_FOUND', 'Zap not found')));
      const { component, el } = create();

      const [id, context] = zaps.get.calls.mostRecent().args as [string, HttpContext];
      expect(id).toBe('abc');
      expect(context.get(HANDLED_ERROR_CODES)).toEqual(['NOT_FOUND']);

      expect(component.notFound).toBeTrue();
      expect(component.form).toBeNull();
      expect(el.querySelector('.loading')).toBeNull();
      const state = el.querySelector('.not-found')!;
      expect(state.textContent).toContain('Zap not found');
      expect(state.querySelector('a')?.getAttribute('href')).toBe('/zaps');
      expect(el.querySelector('button.save')).toBeNull();
    });

    it('another error shows no "Zap not found" state', () => {
      render({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa' });
      zaps.get.and.returnValue(throwError(() => new ApiError(500, 'INTERNAL_ERROR', 'boom')));
      const { component, el } = create();
      expect(component.notFound).toBeFalse();
      expect(el.querySelector('.not-found')).toBeNull();
    });
  });

  describe('create mode', () => {
    for (const [label, appId] of [
      ['a coming-soon app (GitLab)', GITLAB_APP.id],
      ['an unknown appId', 'ffffffffffffffffffffffff'],
      ['a malformed appId', 'abc'],
      ['no appId', undefined],
    ] as const) {
      it(`${label} → /zaps with a snackbar`, () => {
        const { navigate } = render({ appId });
        const { component } = create();
        expect(navigate).toHaveBeenCalledOnceWith(['/zaps'], { replaceUrl: true });
        expect(notifications.show).toHaveBeenCalledOnceWith(ZapBuilderComponent.APP_UNAVAILABLE_MESSAGE);
        expect(component.form).toBeNull();
      });
    }

    it('an available app stays on the builder', () => {
      const { navigate } = render({ appId: GITHUB_APP.id });
      const { component } = create();
      expect(navigate).not.toHaveBeenCalled();
      expect(notifications.show).not.toHaveBeenCalled();
      expect(component.form).not.toBeNull();
    });
  });
});
