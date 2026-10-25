import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import type { AppDto, ZapDto } from '@zaps/shared';
import { filter, finalize, forkJoin, switchMap } from 'rxjs';
import { AppsService } from '../../core/apps.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { AppPickerDialogComponent } from '../app-picker/app-picker-dialog.component';
import { ZapToggleService } from '../zap-toggle.service';
import { ZapsService } from '../zaps.service';
import { ZapCardComponent, ZapToggleEvent } from './zap-card.component';

type ListState = 'loading' | 'ready' | 'error';

/** `/zaps`: the user's Zaps as cards, with loading, empty and error states (Screens.md → Zap list). */
@Component({
  selector: 'app-zap-list',
  standalone: true,
  imports: [NgFor, NgIf, MatButtonModule, MatIconModule, MatProgressSpinnerModule, ZapCardComponent],
  templateUrl: './zap-list.component.html',
  styleUrls: ['./zap-list.component.scss'],
})
export class ZapListComponent implements OnInit {
  private readonly zapsService = inject(ZapsService);
  private readonly appsService = inject(AppsService);
  private readonly dialog = inject(MatDialog);
  private readonly zapToggle = inject(ZapToggleService);
  private readonly router = inject(Router);

  state: ListState = 'loading';
  zaps: ZapDto[] = [];
  apps: AppDto[] = [];
  /** Zaps with an enable/disable request in flight. */
  private readonly togglingIds = new Set<string>();

  ngOnInit(): void {
    this.load();
  }

  /** Loads the Zaps and the app catalog; also the **Retry** handler. */
  load(): void {
    this.state = 'loading';
    forkJoin({ zaps: this.zapsService.list(), apps: this.appsService.getApps() }).subscribe({
      next: ({ zaps, apps }) => {
        this.zaps = zaps;
        this.apps = apps;
        this.state = 'ready';
      },
      // The interceptor already shows the snackbar; the page shows the Retry state.
      error: () => {
        this.state = 'error';
      },
    });
  }

  /** **Create Zap** (header and empty state): opens the app picker (S4). */
  onCreate(): void {
    AppPickerDialogComponent.open(this.dialog);
  }

  /** Card toggle: enable/disable through `ZapToggleService` (S8). */
  onToggle({ zap, enabled }: ZapToggleEvent): void {
    if (this.togglingIds.has(zap.id)) return;
    this.togglingIds.add(zap.id);
    this.zapToggle
      .setEnabled(zap, enabled)
      .pipe(finalize(() => this.togglingIds.delete(zap.id)))
      .subscribe({
        next: (updated) => {
          this.zaps = this.zaps.map((z) => (z.id === updated.id ? updated : z));
        },
        // The interceptor shows the snackbar; the card reverts once `toggling` turns off.
        error: () => undefined,
      });
  }

  /** Whether an enable/disable request for this Zap is running (its toggle is disabled). */
  isToggling(zap: ZapDto): boolean {
    return this.togglingIds.has(zap.id);
  }

  /** Card click or ⋮ → Edit: opens the builder at `/zaps/:id`. */
  onEdit(zap: ZapDto): void {
    void this.router.navigate(['/zaps', zap.id]);
  }

  /** Card ⋮ → Delete: confirm, then `DELETE /api/zaps/:id` (S9). */
  onDelete(zap: ZapDto): void {
    ConfirmDialogComponent.open(this.dialog, {
      title: 'Delete Zap',
      message: `Delete ${zap.name}? Its GitHub webhook will be removed.`,
      confirmLabel: 'Delete',
    })
      .pipe(
        filter((confirmed) => confirmed),
        switchMap(() => this.zapsService.delete(zap.id)),
      )
      .subscribe({
        next: () => {
          this.zaps = this.zaps.filter((z) => z.id !== zap.id);
        },
        // The card stays; the interceptor already shows the snackbar.
        error: () => undefined,
      });
  }

  trackById(_index: number, zap: ZapDto): string {
    return zap.id;
  }
}
