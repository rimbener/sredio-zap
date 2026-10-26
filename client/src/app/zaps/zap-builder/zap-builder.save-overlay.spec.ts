import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideLocationMocks } from '@angular/common/testing';
import { Navigation, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { RepoDto, ZapDto } from '@zaps/shared';
import { Subject, of } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AppsService } from '../../core/apps.service';
import { GithubService } from '../../core/github.service';
import { NotificationService } from '../../core/notification.service';
import { GITHUB_APP as GITHUB, makeZap } from '../testing/zap-fixtures';
import { WebhookExistsDialogComponent } from '../webhook-exists-dialog.component';
import { ZapToggleService } from '../zap-toggle.service';
import { ZapsService } from '../zaps.service';
import { unsavedChangesGuard } from './unsaved-changes.guard';
import { SavedZapState, ZapBuilderComponent } from './zap-builder.component';

const REPOS: RepoDto[] = [
  { owner: 'acme', repo: 'api', fullName: 'acme/api', htmlUrl: 'https://github.com/acme/api' },
  { owner: 'me', repo: 'site', fullName: 'me/site', htmlUrl: 'https://github.com/me/site' },
];
const SAVED = makeZap({ name: 'Thank PRs' });

/** U1: the saving overlay, and no blank builder between a create and edit mode. */
describe('ZapBuilderComponent (saving overlay)', () => {
  let zaps: jasmine.SpyObj<ZapsService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let notifications: jasmine.SpyObj<NotificationService>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    zaps = jasmine.createSpyObj<ZapsService>('ZapsService', ['get', 'create', 'update', 'delete']);
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    notifications = jasmine.createSpyObj<NotificationService>('NotificationService', ['show']);
    TestBed.configureTestingModule({
      providers: [
        // The real builder routes (app.routes.ts), with the unsaved-changes guard (E10).
        provideRouter([
          { path: 'zaps/new', component: ZapBuilderComponent, canDeactivate: [unsavedChangesGuard] },
          { path: 'zaps/:id', component: ZapBuilderComponent, canDeactivate: [unsavedChangesGuard] },
        ]),
        provideLocationMocks(),
        provideNoopAnimations(),
        { provide: AppsService, useValue: { getApps: () => of([GITHUB]) } },
        { provide: GithubService, useValue: { getRepos: () => of(REPOS) } },
        { provide: ZapsService, useValue: zaps },
        { provide: NotificationService, useValue: notifications },
        { provide: ZapToggleService, useValue: jasmine.createSpyObj<ZapToggleService>('ZapToggleService', ['setEnabled']) },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const el = () => harness.routeNativeElement as HTMLElement;
  const overlay = () => el().querySelector('.saving-overlay');
  const saveButton = () => el().querySelector<HTMLButtonElement>('button.save')!;
  const toggleButton = () => el().querySelector<HTMLButtonElement>('mat-slide-toggle button')!;

  /** The builder is still rendered: header, trigger and action cards. */
  function expectBuilderRendered(): void {
    expect(el().querySelector('header input[aria-label="Zap name"]')).not.toBeNull();
    expect(el().textContent).toContain('1. Trigger · GitHub');
    expect(el().textContent).toContain('2. Action · GitHub');
  }

  /** Opens `/zaps/new`, picks a repo and presses Save; the POST answers on `response$`. */
  async function saveNew() {
    const builder = await harness.navigateByUrl(`/zaps/new?appId=${GITHUB.id}`, ZapBuilderComponent);
    const form = builder.form!;
    const response$ = new Subject<ZapDto>();
    zaps.create.and.returnValue(response$);
    form.controls.name.setValue('Thank PRs');
    form.controls.trigger.controls.repo.setValue(REPOS[0]);
    form.markAsDirty();
    harness.detectChanges();
    saveButton().click();
    harness.detectChanges();
    return { builder, form, response$ };
  }

  /** Opens `/zaps/:id` cold, changes the name and presses Save; the PATCH answers on `response$`. */
  async function saveExisting(zap = SAVED) {
    zaps.get.and.returnValue(of(zap));
    const builder = await harness.navigateByUrl(`/zaps/${zap.id}`, ZapBuilderComponent);
    const form = builder.form!;
    const response$ = new Subject<ZapDto>();
    zaps.update.and.returnValue(response$);
    form.controls.name.setValue('Renamed');
    form.markAsDirty();
    harness.detectChanges();
    saveButton().click();
    harness.detectChanges();
    return { builder, form, response$ };
  }

  it('create: while the POST is pending, the overlay covers the builder, still rendered, with its controls disabled', async () => {
    const { form } = await saveNew();

    expect(overlay()).not.toBeNull();
    expect(overlay()?.querySelector('mat-spinner')).not.toBeNull();
    expectBuilderRendered();
    expect(el().querySelector('.save mat-spinner')).not.toBeNull();
    expect(form.disabled).toBeTrue();
    expect(el().querySelector<HTMLInputElement>('header input')!.disabled).toBeTrue();
    expect(el().querySelector<HTMLTextAreaElement>('app-action-step textarea')!.disabled).toBeTrue();
    expect(saveButton().disabled).toBeTrue();
    expect(toggleButton().disabled).toBeTrue();
    expect(el().querySelector('header')!.hasAttribute('inert')).toBeTrue();
    expect(el().querySelector('mat-accordion')!.hasAttribute('inert')).toBeTrue();
  });

  it('create: after the POST, /zaps/:id shows the saved Zap at once, never a builder without its form', async () => {
    const initOf = ZapBuilderComponent.prototype.ngOnInit;
    const firstStates: { editMode: boolean; hasForm: boolean; loading: boolean }[] = [];
    spyOn(ZapBuilderComponent.prototype, 'ngOnInit').and.callFake(function (this: ZapBuilderComponent) {
      initOf.call(this);
      firstStates.push({ editMode: this.editMode, hasForm: this.form !== null, loading: this.loading });
    });
    const { builder, response$ } = await saveNew();
    const created = makeZap({ name: 'Thank PRs' });

    response$.next(created);
    response$.complete();
    // Until the edit-mode builder replaces it, the create-mode one keeps its overlay.
    expect(builder.saving).toBeTrue();
    await harness.fixture.whenStable();
    harness.detectChanges();

    const edit = harness.routeDebugElement!.componentInstance as ZapBuilderComponent;
    expect(edit).not.toBe(builder);
    expect(TestBed.inject(Router).url).toBe(`/zaps/${created.id}`);
    expect(firstStates).toEqual([
      { editMode: false, hasForm: true, loading: false },
      { editMode: true, hasForm: true, loading: false },
    ]);
    expect(zaps.get).not.toHaveBeenCalled();
    expect(el().querySelector('.loading')).toBeNull();
    expect(overlay()).toBeNull();
    expectBuilderRendered();
    expect(edit.zap).toEqual(created);
    expect(edit.repos).toEqual(REPOS);
    expect(edit.reposLoaded).toBeTrue();
    expect(edit.form!.pristine).toBeTrue();
    expect(edit.form!.enabled).toBeTrue();
    expect(edit.form!.controls.name.value).toBe('Thank PRs');
    expect(el().querySelector('.menu-button')).not.toBeNull();
    expect(toggleButton().disabled).toBeFalse();
    // The unsaved-changes guard (E10) let the navigation through without asking.
    expect(dialog.open).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledOnceWith('Saved');
  });

  it('a cold /zaps/:id load still shows the full-page spinner', async () => {
    const zap$ = new Subject<ZapDto>();
    zaps.get.and.returnValue(zap$);
    const builder = await harness.navigateByUrl(`/zaps/${SAVED.id}`, ZapBuilderComponent);

    expect(zaps.get).toHaveBeenCalledTimes(1);
    expect(el().querySelector('.loading mat-spinner')).not.toBeNull();
    expect(builder.form).toBeNull();
    expect(overlay()).toBeNull();

    zap$.next(SAVED);
    zap$.complete();
    harness.detectChanges();
    expect(el().querySelector('.loading')).toBeNull();
    expectBuilderRendered();
  });

  describe('router state from a create is only trusted on a fresh in-app navigation', () => {
    const state: SavedZapState = { savedZap: { zap: SAVED, app: GITHUB, repos: REPOS } };

    function navigation(overrides: Partial<Navigation>): Navigation {
      return {
        trigger: 'imperative',
        previousNavigation: {} as Navigation,
        extras: { state },
        ...overrides,
      } as Navigation;
    }

    async function openWith(current: Navigation) {
      zaps.get.and.returnValue(new Subject<ZapDto>());
      const router = TestBed.inject(Router);
      const real = router.getCurrentNavigation.bind(router);
      // Only the builder's own read is faked; the router keeps its real navigation.
      spyOn(router, 'getCurrentNavigation').and.callFake(() => (real() ? current : null));
      return harness.navigateByUrl(`/zaps/${SAVED.id}`, ZapBuilderComponent);
    }

    it('back/forward (popstate) refetches the Zap', async () => {
      const builder = await openWith(navigation({ trigger: 'popstate' }));
      expect(zaps.get).toHaveBeenCalledTimes(1);
      expect(builder.loading).toBeTrue();
    });

    it('the first navigation after a reload refetches the Zap', async () => {
      const builder = await openWith(navigation({ previousNavigation: null }));
      expect(zaps.get).toHaveBeenCalledTimes(1);
      expect(builder.loading).toBeTrue();
    });

    it('a state for another Zap refetches the Zap', async () => {
      const other = { savedZap: { ...state.savedZap, zap: makeZap({ id: 'bbbbbbbbbbbbbbbbbbbbbbbb' }) } };
      const builder = await openWith(navigation({ extras: { state: other } }));
      expect(zaps.get).toHaveBeenCalledTimes(1);
      expect(builder.loading).toBeTrue();
    });
  });

  it('edit: while the PATCH is pending, the overlay covers the builder and Save, toggle and ⋮ are disabled', async () => {
    const { form, response$, builder } = await saveExisting();

    expect(overlay()).not.toBeNull();
    expectBuilderRendered();
    expect(form.disabled).toBeTrue();
    expect(saveButton().disabled).toBeTrue();
    expect(toggleButton().disabled).toBeTrue();
    expect(el().querySelector<HTMLButtonElement>('.menu-button')!.disabled).toBeTrue();

    response$.next({ ...SAVED, name: 'Renamed' });
    response$.complete();
    harness.detectChanges();
    expect(overlay()).toBeNull();
    expect(form.enabled).toBeTrue();
    expect(form.pristine).toBeTrue();
    expect(builder.zap?.name).toBe('Renamed');
    expect(el().querySelector<HTMLButtonElement>('.menu-button')!.disabled).toBeFalse();
    expect(toggleButton().disabled).toBeFalse();
  });

  describe('a save error removes the overlay and keeps the form values', () => {
    const ERRORS: [string, () => ApiError][] = [
      [
        'VALIDATION_ERROR',
        () =>
          new ApiError(400, 'VALIDATION_ERROR', 'Invalid request', [
            { path: ['action', 'config', 'body'], message: 'Unknown token {{pr.nope}}' },
          ]),
      ],
      ['WEBHOOK_EXISTS', () => new ApiError(409, 'WEBHOOK_EXISTS', 'Leftover hook', { hookSettingsUrl: 'https://x' })],
      ['other', () => new ApiError(502, 'GITHUB_ERROR', 'GitHub failed')],
    ];

    for (const [code, error] of ERRORS) {
      it(`create: ${code}`, async () => {
        const { form, response$ } = await saveNew();
        const before = form.getRawValue();
        response$.error(error());
        harness.detectChanges();

        expect(overlay()).toBeNull();
        expectBuilderRendered();
        expect(form.enabled).toBeTrue();
        expect(form.dirty).toBeTrue();
        expect(form.getRawValue()).toEqual(before);
        expect(TestBed.inject(Router).url).toBe(`/zaps/new?appId=${GITHUB.id}`);
        if (code === 'VALIDATION_ERROR') {
          expect(form.controls.action.controls.body.getError('zod')).toBe('Unknown token {{pr.nope}}');
        }
        if (code === 'WEBHOOK_EXISTS') expect(dialog.open.calls.mostRecent().args[0]).toBe(WebhookExistsDialogComponent);
      });

      it(`edit: ${code}`, async () => {
        const { form, response$, builder } = await saveExisting({ ...SAVED, enabled: true });
        const before = form.getRawValue();
        response$.error(error());
        harness.detectChanges();

        expect(overlay()).toBeNull();
        expectBuilderRendered();
        expect(form.enabled).toBeTrue();
        expect(form.dirty).toBeTrue();
        expect(form.getRawValue()).toEqual(before);
        expect(builder.zap?.name).toBe('Thank PRs');
        expect(saveButton().disabled).toBe(code === 'VALIDATION_ERROR');
        if (code === 'VALIDATION_ERROR') {
          expect(form.controls.action.controls.body.getError('zod')).toBe('Unknown token {{pr.nope}}');
        }
        if (code === 'WEBHOOK_EXISTS') expect(dialog.open.calls.mostRecent().args[0]).toBe(WebhookExistsDialogComponent);
      });
    }
  });
});
