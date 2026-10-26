import { NgIf } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggle, MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { AppDto, RepoDto, ZapDto } from '@zaps/shared';
import { Observable, catchError, filter, finalize, forkJoin, of, switchMap } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { AppsService } from '../../core/apps.service';
import { GithubService } from '../../core/github.service';
import { HANDLED_ERROR_CODES } from '../../core/http-error.interceptor';
import { NotificationService } from '../../core/notification.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { WEBHOOK_EXISTS_SAVE_MESSAGE, WebhookExistsDialogComponent } from '../webhook-exists-dialog.component';
import { ZapToggleService } from '../zap-toggle.service';
import { ZapsService } from '../zaps.service';
import { ActionStepComponent } from './action-step.component';
import { applyValidationErrors, saveContext } from './form-errors';
import { TriggerStepComponent } from './trigger-step.component';
import { ZapForm, createZapForm, editZapForm, toCreateZapInput, toPatchZapInput } from './zap-form';

/**
 * Router `state` from a create-mode Save to `/zaps/:id` (U1): the created Zap, its app and the
 * repo list (`null` if it failed to load), so the edit-mode builder shows them at once
 * instead of refetching them behind a full-page spinner.
 */
export interface SavedZapState {
  savedZap: { zap: ZapDto; app: AppDto; repos: RepoDto[] | null };
}

/**
 * The Zap builder page and its header bar (Screens.md → Zap builder).
 * Create mode is `/zaps/new?appId=…`; edit mode is `/zaps/:id`.
 */
@Component({
  selector: 'app-zap-builder',
  standalone: true,
  imports: [
    NgIf,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    ActionStepComponent,
    TriggerStepComponent,
  ],
  templateUrl: './zap-builder.component.html',
  styleUrls: ['./zap-builder.component.scss'],
})
export class ZapBuilderComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apps = inject(AppsService);
  private readonly github = inject(GithubService);
  private readonly zaps = inject(ZapsService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly zapToggle = inject(ZapToggleService);
  private readonly destroyRef = inject(DestroyRef);

  /** Snackbar for `/zaps/new` with a missing, unknown or coming-soon `appId` (E9). */
  static readonly APP_UNAVAILABLE_MESSAGE = "This app isn't available yet.";

  /** Info banner while editing an enabled Zap (Screens.md → States, E6). */
  static readonly ENABLED_BANNER = 'This Zap is on. Saving changes to the repository moves its webhook.';
  readonly enabledBanner = ZapBuilderComponent.ENABLED_BANNER;

  static readonly TOGGLE_TOOLTIP = 'Save your changes before turning this Zap on/off';
  readonly toggleTooltip = ZapBuilderComponent.TOGGLE_TOOLTIP;

  /** The Zap's id in edit mode (`/zaps/:id`); `null` in create mode (`/zaps/new`). */
  readonly zapId = this.route.snapshot.paramMap.get('id');
  readonly editMode = this.zapId !== null;
  app: AppDto | null = null;
  form: ZapForm | null = null;
  /** The Zap as last saved (edit mode). PATCH sends only what differs from it. */
  zap: ZapDto | null = null;
  repos: RepoDto[] = [];
  /** True once the repo list arrived; it stays false if the list failed to load. */
  reposLoaded = false;
  loading = false;
  saving = false;
  /** Edit mode: the Zap doesn't exist or isn't the user's (`404 NOT_FOUND`). */
  notFound = false;
  /** True while a header enable/disable request runs. */
  toggling = false;

  @ViewChild(MatSlideToggle) private slideToggle?: MatSlideToggle;

  /** Read here: the current navigation is only available while this component is being created. */
  private readonly savedState = this.readSavedState();

  ngOnInit(): void {
    if (this.zapId === null) this.loadCreate();
    else if (this.savedState) this.showSaved(this.savedState);
    else this.loadEdit(this.zapId);
  }

  get canSave(): boolean {
    return !!this.form && this.form.dirty && this.form.valid && !this.saving;
  }

  /**
   * The header toggle needs a saved Zap and no unsaved changes (Screens.md → Header bar);
   * the tooltip explains it while this is true.
   */
  get toggleBlocked(): boolean {
    return !this.zap || !this.form || this.form.dirty;
  }

  /** Header toggle: enable/disable through `ZapToggleService`, reverting on error (S11). */
  onToggle(change: MatSlideToggleChange): void {
    const { zap } = this;
    if (!zap || this.toggleBlocked || this.toggling) return;
    this.toggling = true;
    this.zapToggle
      .setEnabled(zap, change.checked)
      .pipe(
        finalize(() => {
          this.toggling = false;
          // On error `zap.enabled` is unchanged, so `[checked]` never fires: snap the switch back.
          if (this.slideToggle && this.zap) this.slideToggle.checked = this.zap.enabled;
        }),
      )
      .subscribe({
        next: (updated) => {
          this.zap = updated;
        },
        // The interceptor already showed the snackbar.
        error: () => undefined,
      });
  }

  /** Header ⋮ → Delete: the list's confirm dialog, `DELETE /api/zaps/:id`, then `/zaps` (S11). */
  onDelete(): void {
    const { zap } = this;
    if (!zap) return;
    ConfirmDialogComponent.open(this.dialog, {
      title: 'Delete Zap',
      message: `Delete ${zap.name}? Its GitHub webhook will be removed.`,
      confirmLabel: 'Delete',
    })
      .pipe(
        filter((confirmed) => confirmed),
        switchMap(() => this.zaps.delete(zap.id)),
      )
      .subscribe({
        next: () => {
          // The Zap is gone, so nothing is left to save: keep the unsaved-changes guard (E10) quiet.
          this.form?.markAsPristine();
          void this.router.navigate(['/zaps']);
        },
        // The builder stays; the interceptor already showed the snackbar.
        error: () => undefined,
      });
  }

  save(): void {
    const { form, app, zap } = this;
    if (!form || !app || !this.canSave) return;
    if (zap) this.update(app, form, zap);
    else this.create(app, form);
  }

  /**
   * Create mode: the app from `?appId=` and the repo list load independently.
   * A missing or unknown `appId`, or a coming-soon app, goes back to `/zaps` with a snackbar
   * (Screens.md → Routes).
   */
  private loadCreate(): void {
    const appId = this.route.snapshot.queryParamMap.get('appId');
    if (!appId) {
      this.leaveUnavailableApp();
      return;
    }
    this.apps
      .getApps()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apps) => {
          const app = apps.find((a) => a.id === appId && a.status === 'available');
          if (!app) {
            this.leaveUnavailableApp();
            return;
          }
          this.app = app;
          this.form = createZapForm(app);
        },
        error: () => undefined, // the interceptor already showed a snackbar
      });

    this.loadRepos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((repos) => this.setRepos(repos));
  }

  /**
   * Edit mode: a spinner while the Zap, the app catalog and the repo list load
   * (Screens.md → States). A `404` shows the "Zap not found" state instead of a snackbar;
   * any other failure leaves the snackbar to the interceptor and the page stays empty.
   */
  private loadEdit(id: string): void {
    this.loading = true;
    const context = new HttpContext().set(HANDLED_ERROR_CODES, ['NOT_FOUND']);
    forkJoin({ zap: this.zaps.get(id, context), apps: this.apps.getApps(), repos: this.loadRepos() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ zap, apps, repos }) => {
          this.loading = false;
          this.setRepos(repos);
          const app = apps.find((a) => a.id === zap.appId);
          if (!app) return;
          this.zap = zap;
          this.app = app;
          this.form = editZapForm(app, zap);
        },
        error: (err: unknown) => {
          this.loading = false;
          this.notFound = err instanceof ApiError && err.code === 'NOT_FOUND';
        },
      });
  }

  /**
   * The Zap just created by the create-mode builder, passed in the router `state` of the
   * Save navigation. Only for a fresh in-app navigation (not the first one after a reload,
   * nor back/forward), so a stale history entry is never shown instead of the server's copy.
   */
  private readSavedState(): SavedZapState['savedZap'] | null {
    const navigation = this.router.getCurrentNavigation();
    if (!navigation || navigation.trigger !== 'imperative' || !navigation.previousNavigation) return null;
    const saved = (navigation.extras.state as Partial<SavedZapState> | undefined)?.savedZap;
    return saved && saved.zap.id === this.zapId ? saved : null;
  }

  /** Edit mode right after a create: the saved Zap, without a load (U1). */
  private showSaved({ zap, app, repos }: SavedZapState['savedZap']): void {
    this.setRepos(repos);
    this.zap = zap;
    this.app = app;
    this.form = editZapForm(app, zap);
  }

  private leaveUnavailableApp(): void {
    void this.router.navigate(['/zaps'], { replaceUrl: true });
    this.notifications.show(ZapBuilderComponent.APP_UNAVAILABLE_MESSAGE);
  }

  /**
   * The repo list, loaded once; the trigger step filters it locally. On failure the
   * interceptor shows its snackbar and the autocomplete stays empty (Screens.md → Trigger card).
   */
  private loadRepos(): Observable<RepoDto[] | null> {
    return this.github.getRepos().pipe(catchError(() => of(null)));
  }

  private setRepos(repos: RepoDto[] | null): void {
    this.repos = repos ?? [];
    this.reposLoaded = repos !== null;
  }

  private create(app: AppDto, form: ZapForm): void {
    const input = toCreateZapInput(app, form.getRawValue());
    this.startSaving(form);
    this.zaps.create(input, saveContext()).subscribe({
      next: (zap) => {
        // Pristine first, so the unsaved-changes guard (E10) doesn't block the navigation.
        form.markAsPristine();
        const state: SavedZapState = { savedZap: { zap, app, repos: this.reposLoaded ? this.repos : null } };
        // The overlay stays until the edit-mode builder replaces this one (U1).
        const done = () => this.stopSaving(form);
        this.router.navigate(['/zaps', zap.id], { replaceUrl: true, state }).then(done, done);
        this.notifications.show('Saved');
      },
      error: (error: unknown) => {
        // The form keeps its values; the interceptor shows the snackbar for other codes.
        this.stopSaving(form);
        this.showSaveError(form, error);
      },
    });
  }

  /** The saving overlay covers the builder and its form can't be edited (Screens.md → States). */
  private startSaving(form: ZapForm): void {
    this.saving = true;
    form.disable();
  }

  /** Before any save error is applied: field errors (E8) need enabled controls. */
  private stopSaving(form: ZapForm): void {
    this.saving = false;
    form.enable();
  }

  /** Edit mode: PATCH only the changed top-level fields (Screens.md → Header bar → Save). */
  private update(app: AppDto, form: ZapForm, saved: ZapDto): void {
    const patch = toPatchZapInput(app, form.getRawValue(), saved);
    if (Object.keys(patch).length === 0) {
      // Edited back to the saved values: nothing to send.
      form.markAsPristine();
      this.notifications.show('Saved');
      return;
    }
    this.startSaving(form);
    this.zaps.update(saved.id, patch, saveContext()).subscribe({
      next: (zap) => {
        this.zap = zap;
        this.stopSaving(form);
        form.markAsPristine();
        this.notifications.show('Saved');
      },
      error: (error: unknown) => {
        // The form stays dirty with its values; the interceptor shows the snackbar for other codes.
        this.stopSaving(form);
        this.showSaveError(form, error);
      },
    });
  }

  /**
   * Save errors the builder handles itself: `VALIDATION_ERROR` → field errors, and a snackbar
   * for what no field shows (E8); `WEBHOOK_EXISTS` (repo move on an enabled Zap) → the
   * leftover-webhook dialog with the Save text, nothing saved and the form left dirty (E6).
   */
  private showSaveError(form: ZapForm, error: unknown): void {
    if (!(error instanceof ApiError)) return;
    if (error.code === 'WEBHOOK_EXISTS') {
      WebhookExistsDialogComponent.open(this.dialog, error, WEBHOOK_EXISTS_SAVE_MESSAGE);
      return;
    }
    if (error.code !== 'VALIDATION_ERROR') return;
    const message = applyValidationErrors(form, error);
    if (message) this.notifications.show(message);
  }
}
