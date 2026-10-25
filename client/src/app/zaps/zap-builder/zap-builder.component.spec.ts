import { HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type { RepoDto, ZapDto } from '@zaps/shared';
import { Subject, of, throwError } from 'rxjs';
import { AppsService } from '../../core/apps.service';
import { GithubService } from '../../core/github.service';
import { NotificationService } from '../../core/notification.service';
import { GITHUB_APP as GITHUB, makeZap } from '../testing/zap-fixtures';
import { ZapsService } from '../zaps.service';
import { ZapBuilderComponent } from './zap-builder.component';
import { DEFAULT_COMMENT_BODY } from './zap-form';

const REPOS: RepoDto[] = [
  { owner: 'acme', repo: 'api', fullName: 'acme/api', htmlUrl: 'https://github.com/acme/api' },
  { owner: 'me', repo: 'site', fullName: 'me/site', htmlUrl: 'https://github.com/me/site' },
];

const ZAP = makeZap({ name: 'Untitled Zap' });

describe('ZapBuilderComponent (create mode)', () => {
  let zaps: jasmine.SpyObj<ZapsService>;
  let notifications: jasmine.SpyObj<NotificationService>;

  function render() {
    zaps = jasmine.createSpyObj<ZapsService>('ZapsService', ['create']);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['show']);
    TestBed.configureTestingModule({
      imports: [ZapBuilderComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({ appId: GITHUB.id }) },
          },
        },
        { provide: AppsService, useValue: { getApps: () => of([GITHUB]) } },
        { provide: GithubService, useValue: { getRepos: () => of(REPOS) } },
        { provide: ZapsService, useValue: zaps },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    const fixture = TestBed.createComponent(ZapBuilderComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    const saveButton = () => el.querySelector<HTMLButtonElement>('button.save')!;
    return { fixture, component, el, saveButton, form: component.form! };
  }

  it('prefills name, events and the default comment; no repo yet', () => {
    const { form, el } = render();
    expect(form.getRawValue()).toEqual({
      name: 'Untitled Zap',
      trigger: { event: 'pull_request.opened', repo: null },
      action: { event: 'pull_request.comment', body: DEFAULT_COMMENT_BODY },
    });
    expect(el.textContent).toContain('1. Trigger · GitHub');
    expect(el.textContent).toContain('2. Action · GitHub');
  });

  it('Save is disabled while the form is pristine', () => {
    const { saveButton, form } = render();
    expect(form.pristine).toBeTrue();
    expect(saveButton().disabled).toBeTrue();
  });

  it('Save is disabled while invalid (no repo), enabled once a repo is picked', () => {
    const { fixture, saveButton, form } = render();
    form.controls.name.setValue('Thank PRs');
    form.markAsDirty();
    fixture.detectChanges();
    expect(form.valid).toBeFalse();
    expect(saveButton().disabled).toBeTrue();

    form.controls.trigger.controls.repo.setValue(REPOS[0]);
    fixture.detectChanges();
    expect(form.valid).toBeTrue();
    expect(saveButton().disabled).toBeFalse();
  });

  it('a free-text repo is invalid', () => {
    const { fixture, saveButton, form } = render();
    const repo = form.controls.trigger.controls.repo;
    repo.setValue('acme/api');
    repo.markAsDirty();
    fixture.detectChanges();
    expect(repo.hasError('repoNotPicked')).toBeTrue();
    expect(form.valid).toBeFalse();
    expect(saveButton().disabled).toBeTrue();
  });

  it('an empty name or comment is invalid', () => {
    const { form } = render();
    form.controls.trigger.controls.repo.setValue(REPOS[0]);
    form.controls.name.setValue('');
    expect(form.controls.name.getError('zod')).toBe('Name is required');
    expect(form.valid).toBeFalse();
    form.controls.name.setValue('Thank PRs');
    form.controls.action.controls.body.setValue('');
    expect(form.controls.action.controls.body.getError('zod')).toBe('Comment is required');
    expect(form.valid).toBeFalse();
  });

  it('an unknown token makes the form invalid (shared zod schema)', () => {
    const { form } = render();
    form.controls.trigger.controls.repo.setValue(REPOS[0]);
    form.controls.action.controls.body.setValue('Hi {{pr.nope}}');
    expect(form.valid).toBeFalse();
    expect(form.hasError('zap')).toBeTrue();
  });

  it('Save POSTs, then marks the form pristine, then navigates, then shows "Saved"', () => {
    const { fixture, saveButton, form } = render();
    const router = TestBed.inject(Router);
    const order: string[] = [];
    zaps.create.and.callFake(() => {
      order.push('create');
      return of(ZAP);
    });
    spyOn(form, 'markAsPristine').and.callFake(() => {
      order.push('markAsPristine');
    });
    const navigate = spyOn(router, 'navigate').and.callFake(() => {
      order.push('navigate');
      return Promise.resolve(true);
    });
    notifications.show.and.callFake(() => {
      order.push('snackbar');
    });

    form.controls.trigger.controls.repo.setValue(REPOS[0]);
    form.markAsDirty();
    fixture.detectChanges();
    saveButton().click();

    expect(order).toEqual(['create', 'markAsPristine', 'navigate', 'snackbar']);
    expect(zaps.create).toHaveBeenCalledWith({
      appId: GITHUB.id,
      name: 'Untitled Zap',
      trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'acme', repo: 'api' } },
      action: { app: 'github', event: 'pull_request.comment', config: { body: DEFAULT_COMMENT_BODY } },
    }, jasmine.any(HttpContext));
    expect(navigate).toHaveBeenCalledWith(['/zaps', ZAP.id], { replaceUrl: true });
    expect(notifications.show).toHaveBeenCalledWith('Saved');
  });

  it('a failed save keeps the form dirty and re-enables Save', () => {
    const { fixture, saveButton, form, component } = render();
    zaps.create.and.returnValue(throwError(() => new Error('boom')));
    form.controls.trigger.controls.repo.setValue(REPOS[0]);
    form.markAsDirty();
    fixture.detectChanges();
    saveButton().click();
    fixture.detectChanges();

    expect(component.saving).toBeFalse();
    expect(form.dirty).toBeTrue();
    expect(saveButton().disabled).toBeFalse();
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('the on/off toggle is disabled in create mode', () => {
    const { el } = render();
    const toggle = el.querySelector<HTMLButtonElement>('mat-slide-toggle button')!;
    expect(toggle.disabled).toBeTrue();
  });
});

describe('ZapBuilderComponent (edit mode)', () => {
  const SAVED = makeZap({
    name: 'Thank PRs',
    trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'acme', repo: 'api' } },
    action: { app: 'github', event: 'pull_request.comment', config: { body: 'Thanks!' } },
  });

  let zaps: jasmine.SpyObj<ZapsService>;
  let notifications: jasmine.SpyObj<NotificationService>;
  let zap$: Subject<ZapDto>;

  function render() {
    zaps = jasmine.createSpyObj<ZapsService>('ZapsService', ['get', 'update', 'create']);
    zap$ = new Subject<ZapDto>();
    zaps.get.and.returnValue(zap$);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['show']);
    TestBed.configureTestingModule({
      imports: [ZapBuilderComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: SAVED.id }), queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: AppsService, useValue: { getApps: () => of([GITHUB]) } },
        { provide: GithubService, useValue: { getRepos: () => of(REPOS) } },
        { provide: ZapsService, useValue: zaps },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    const fixture = TestBed.createComponent(ZapBuilderComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    const saveButton = () => el.querySelector<HTMLButtonElement>('button.save')!;
    /** Delivers the Zap, finishing the initial load. */
    const load = (zap = SAVED) => {
      zap$.next(zap);
      zap$.complete();
      fixture.detectChanges();
      return component.form!;
    };
    return { fixture, component, el, saveButton, load };
  }

  it('shows a spinner until the Zap, apps and repos load, then the saved values, pristine', () => {
    const { el, component, load } = render();
    expect(zaps.get).toHaveBeenCalledWith(SAVED.id);
    expect(el.querySelector('.loading mat-spinner')).not.toBeNull();
    expect(component.form).toBeNull();

    const form = load();
    expect(el.querySelector('.loading')).toBeNull();
    expect(form.pristine).toBeTrue();
    expect(form.valid).toBeTrue();
    expect(form.getRawValue()).toEqual({
      name: 'Thank PRs',
      trigger: {
        event: 'pull_request.opened',
        repo: { owner: 'acme', repo: 'api', fullName: 'acme/api', htmlUrl: 'https://github.com/acme/api' },
      },
      action: { event: 'pull_request.comment', body: 'Thanks!' },
    });
    expect(component.repos).toEqual(REPOS);
  });

  it('Save is disabled until something changes', () => {
    const { fixture, saveButton, load } = render();
    const form = load();
    expect(saveButton().disabled).toBeTrue();
    form.controls.name.setValue('Renamed');
    form.markAsDirty();
    fixture.detectChanges();
    expect(saveButton().disabled).toBeFalse();
  });

  it('a rename PATCHes only the name, then marks pristine and shows "Saved"', () => {
    const { fixture, saveButton, load, component } = render();
    const form = load();
    const renamed = { ...SAVED, name: 'Renamed', updatedAt: '2026-10-26T10:00:00.000Z' };
    zaps.update.and.returnValue(of(renamed));

    form.controls.name.setValue('Renamed');
    form.markAsDirty();
    fixture.detectChanges();
    saveButton().click();
    fixture.detectChanges();

    expect(zaps.update).toHaveBeenCalledOnceWith(SAVED.id, { name: 'Renamed' }, jasmine.any(HttpContext));
    expect(zaps.create).not.toHaveBeenCalled();
    expect(form.pristine).toBeTrue();
    expect(notifications.show).toHaveBeenCalledWith('Saved');
    expect(component.zap).toEqual(renamed);
    expect(saveButton().disabled).toBeTrue();
  });

  it('a new repo and comment PATCH whole trigger and action steps, without the name', () => {
    const { fixture, saveButton, load } = render();
    const form = load();
    zaps.update.and.returnValue(of(SAVED));

    form.controls.trigger.controls.repo.setValue(REPOS[1]);
    form.controls.action.controls.body.setValue('Hi {{pr.author}}');
    form.markAsDirty();
    fixture.detectChanges();
    saveButton().click();

    expect(zaps.update).toHaveBeenCalledOnceWith(SAVED.id, {
      trigger: { app: 'github', event: 'pull_request.opened', config: { owner: 'me', repo: 'site' } },
      action: { app: 'github', event: 'pull_request.comment', config: { body: 'Hi {{pr.author}}' } },
    }, jasmine.any(HttpContext));
  });

  it('edits reverted to the saved values send no request', () => {
    const { fixture, saveButton, load } = render();
    const form = load();
    form.controls.name.setValue('Renamed');
    form.controls.name.setValue('Thank PRs');
    form.markAsDirty();
    fixture.detectChanges();
    saveButton().click();

    expect(zaps.update).not.toHaveBeenCalled();
    expect(form.pristine).toBeTrue();
  });

  it('a failed PATCH keeps the form dirty and re-enables Save', () => {
    const { fixture, saveButton, load, component } = render();
    const form = load();
    zaps.update.and.returnValue(throwError(() => new Error('boom')));
    form.controls.name.setValue('Renamed');
    form.markAsDirty();
    fixture.detectChanges();
    saveButton().click();
    fixture.detectChanges();

    expect(component.saving).toBeFalse();
    expect(form.dirty).toBeTrue();
    expect(component.zap).toEqual(SAVED);
    expect(saveButton().disabled).toBeFalse();
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('a failed load hides the spinner and shows no form', () => {
    const { fixture, el, component } = render();
    zap$.error(new Error('boom'));
    fixture.detectChanges();
    expect(component.loading).toBeFalse();
    expect(el.querySelector('.loading')).toBeNull();
    expect(component.form).toBeNull();
  });
});
