import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Route, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { RepoDto } from '@zaps/shared';
import { Subject, of } from 'rxjs';
import { routes } from '../../app.routes';
import { AppsService } from '../../core/apps.service';
import { GithubService } from '../../core/github.service';
import { NotificationService } from '../../core/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { GITHUB_APP, makeZap } from '../testing/zap-fixtures';
import { ZapsService } from '../zaps.service';
import { ZapBuilderComponent } from './zap-builder.component';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

@Component({ standalone: true, template: '' })
class StubBuilderComponent implements HasUnsavedChanges {
  form: FormControl<string | null> | null = new FormControl('Untitled Zap');
}

@Component({ standalone: true, template: '' })
class StubPageComponent {}

/** Lets a pending navigation run up to the guard's dialog. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('unsavedChangesGuard', () => {
  let dialogResult: Subject<boolean | undefined>;
  let dialog: jasmine.SpyObj<MatDialog>;

  async function openBuilder() {
    dialogResult = new Subject();
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialog.open.and.returnValue({ afterClosed: () => dialogResult } as never);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'zaps/new', component: StubBuilderComponent, canDeactivate: [unsavedChangesGuard] },
          { path: 'zaps', component: StubPageComponent },
          { path: 'login', component: StubPageComponent },
        ]),
        { provide: MatDialog, useValue: dialog },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const builder = await harness.navigateByUrl('/zaps/new', StubBuilderComponent);
    return { router: TestBed.inject(Router), builder };
  }

  it('a clean form leaves without a dialog', async () => {
    const { router } = await openBuilder();
    expect(await router.navigateByUrl('/zaps')).toBeTrue();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(router.url).toBe('/zaps');
  });

  it('a form that was never built leaves without a dialog', async () => {
    const { router, builder } = await openBuilder();
    builder.form = null;
    expect(await router.navigateByUrl('/zaps')).toBeTrue();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('a dirty form asks "Discard unsaved changes?" with Keep editing / Discard', async () => {
    const { router, builder } = await openBuilder();
    builder.form!.markAsDirty();
    void router.navigateByUrl('/zaps');
    await settle();
    expect(dialog.open).toHaveBeenCalledOnceWith(ConfirmDialogComponent, {
      data: {
        title: 'Discard unsaved changes?',
        message: "Your changes to this Zap haven't been saved.",
        cancelLabel: 'Keep editing',
        confirmLabel: 'Discard',
      },
    });
  });

  it('dirty + Keep editing stays in the builder', async () => {
    const { router, builder } = await openBuilder();
    builder.form!.markAsDirty();
    const navigation = router.navigateByUrl('/zaps');
    await settle();
    dialogResult.next(false);
    dialogResult.complete();
    expect(await navigation).toBeFalse();
    expect(router.url).toBe('/zaps/new');
  });

  it('dirty + Esc or backdrop click (no result) stays in the builder', async () => {
    const { router, builder } = await openBuilder();
    builder.form!.markAsDirty();
    const navigation = router.navigateByUrl('/zaps');
    await settle();
    dialogResult.next(undefined);
    dialogResult.complete();
    expect(await navigation).toBeFalse();
    expect(router.url).toBe('/zaps/new');
  });

  it('dirty + Discard leaves', async () => {
    const { router, builder } = await openBuilder();
    builder.form!.markAsDirty();
    const navigation = router.navigateByUrl('/zaps');
    await settle();
    dialogResult.next(true);
    dialogResult.complete();
    expect(await navigation).toBeTrue();
    expect(router.url).toBe('/zaps');
  });

  it('dirty + an auth redirect (state.authRedirect) leaves without a dialog', async () => {
    const { router, builder } = await openBuilder();
    builder.form!.markAsDirty();
    expect(await router.navigate(['/login'], { state: { authRedirect: true } })).toBeTrue();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(router.url).toBe('/login');
  });

  it('dirty + a plain navigation to /login (sign-out) still asks', async () => {
    const { router, builder } = await openBuilder();
    builder.form!.markAsDirty();
    void router.navigate(['/login']);
    await settle();
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });
});

describe('unsavedChangesGuard on the app routes', () => {
  function findRoute(path: string, list: Route[] = routes): Route | undefined {
    for (const route of list) {
      if (route.path === path) return route;
      const child = findRoute(path, route.children ?? []);
      if (child) return child;
    }
    return undefined;
  }

  it('guards exactly the two builder routes', () => {
    expect(findRoute('zaps/new')?.canDeactivate).toEqual([unsavedChangesGuard]);
    expect(findRoute('zaps/:id')?.canDeactivate).toEqual([unsavedChangesGuard]);
    expect(findRoute('zaps')?.canDeactivate).toBeUndefined();
    expect(findRoute('login')?.canDeactivate).toBeUndefined();
  });
});

describe('unsavedChangesGuard with the real builder', () => {
  const REPO: RepoDto = { owner: 'acme', repo: 'api', fullName: 'acme/api', htmlUrl: 'https://github.com/acme/api' };
  const ZAP = makeZap({ name: 'Untitled Zap' });

  it('after a create-mode Save the navigation to /zaps/:id shows no dialog', async () => {
    const dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([
          { path: 'zaps/new', component: ZapBuilderComponent, canDeactivate: [unsavedChangesGuard] },
          { path: 'zaps/:id', component: ZapBuilderComponent, canDeactivate: [unsavedChangesGuard] },
        ]),
        { provide: MatDialog, useValue: dialog },
        { provide: AppsService, useValue: { getApps: () => of([GITHUB_APP]) } },
        { provide: GithubService, useValue: { getRepos: () => of([REPO]) } },
        { provide: ZapsService, useValue: { create: () => of(ZAP), get: () => of(ZAP) } },
        { provide: NotificationService, useValue: { show: () => undefined } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const builder = await harness.navigateByUrl(`/zaps/new?appId=${GITHUB_APP.id}`, ZapBuilderComponent);
    builder.form!.controls.trigger.controls.repo.setValue(REPO);
    builder.form!.markAsDirty();

    builder.save();
    await harness.fixture.whenStable();

    expect(dialog.open).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe(`/zaps/${ZAP.id}`);
  });
});
