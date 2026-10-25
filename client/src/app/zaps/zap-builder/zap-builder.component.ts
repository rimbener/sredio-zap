import { NgIf } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { AppDto, RepoDto, ZapDto } from '@zaps/shared';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { AppsService } from '../../core/apps.service';
import { GithubService } from '../../core/github.service';
import { NotificationService } from '../../core/notification.service';
import { ZapsService } from '../zaps.service';
import { ActionStepComponent } from './action-step.component';
import { TriggerStepComponent } from './trigger-step.component';
import { ZapForm, createZapForm, editZapForm, toCreateZapInput, toPatchZapInput } from './zap-form';

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
  private readonly destroyRef = inject(DestroyRef);

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

  ngOnInit(): void {
    if (this.zapId !== null) this.loadEdit(this.zapId);
    else this.loadCreate();
  }

  get canSave(): boolean {
    return !!this.form && this.form.dirty && this.form.valid && !this.saving;
  }

  save(): void {
    const { form, app, zap } = this;
    if (!form || !app || !this.canSave) return;
    if (zap) this.update(app, form, zap);
    else this.create(app, form);
  }

  /** Create mode: the app from `?appId=` and the repo list load independently. */
  private loadCreate(): void {
    const appId = this.route.snapshot.queryParamMap.get('appId');
    this.apps
      .getApps()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apps) => {
          // An unknown or coming-soon `appId` is E9; the builder just stays empty.
          const app = apps.find((a) => a.id === appId && a.status === 'available');
          if (!app) return;
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
   * (Screens.md → States). If the Zap or the catalog fails, the interceptor shows its
   * snackbar and the page stays empty; the "Zap not found" state is E9.
   */
  private loadEdit(id: string): void {
    this.loading = true;
    forkJoin({ zap: this.zaps.get(id), apps: this.apps.getApps(), repos: this.loadRepos() })
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
        error: () => {
          this.loading = false;
        },
      });
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
    this.saving = true;
    this.zaps.create(toCreateZapInput(app, form.getRawValue())).subscribe({
      next: (zap) => {
        // Pristine first, so the unsaved-changes guard (E10) doesn't block the navigation.
        form.markAsPristine();
        void this.router.navigate(['/zaps', zap.id], { replaceUrl: true });
        this.notifications.show('Saved');
        this.saving = false;
      },
      error: () => {
        // The interceptor shows the snackbar; the form keeps its values.
        this.saving = false;
      },
    });
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
    this.saving = true;
    this.zaps.update(saved.id, patch).subscribe({
      next: (zap) => {
        this.zap = zap;
        form.markAsPristine();
        this.notifications.show('Saved');
        this.saving = false;
      },
      error: () => {
        // The interceptor shows the snackbar; the form stays dirty with its values.
        this.saving = false;
      },
    });
  }
}
