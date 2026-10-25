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
import type { AppDto, RepoDto } from '@zaps/shared';
import { catchError, of } from 'rxjs';
import { AppsService } from '../../core/apps.service';
import { GithubService } from '../../core/github.service';
import { NotificationService } from '../../core/notification.service';
import { ZapsService } from '../zaps.service';
import { ActionStepComponent } from './action-step.component';
import { TriggerStepComponent } from './trigger-step.component';
import { ZapForm, createZapForm, toCreateZapInput } from './zap-form';

/**
 * The Zap builder page and its header bar (Screens.md → Zap builder).
 * Create mode is `/zaps/new?appId=…`; edit mode (`/zaps/:id`) arrives with S7.
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

  readonly editMode = this.route.snapshot.paramMap.has('id');
  app: AppDto | null = null;
  form: ZapForm | null = null;
  repos: RepoDto[] = [];
  saving = false;

  ngOnInit(): void {
    if (this.editMode) return; // S7 loads the Zap.

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

    // Loaded once; the trigger step filters it locally. On failure the interceptor shows
    // its snackbar and the autocomplete stays empty (Screens.md → Trigger card).
    this.github
      .getRepos()
      .pipe(
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((repos) => (this.repos = repos));
  }

  get canSave(): boolean {
    return !!this.form && this.form.dirty && this.form.valid && !this.saving;
  }

  save(): void {
    const { form, app } = this;
    if (!form || !app || !this.canSave) return;
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
}
