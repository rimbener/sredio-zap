import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import type { AppDto } from '@zaps/shared';
import { AppsService } from '../../core/apps.service';

/**
 * "Choose the app that starts your Zap" (Screens.md → App picker dialog). Tiles come
 * from `AppsService` in `order`; only `available` apps can be picked. Picking one closes
 * the dialog and opens `/zaps/new?appId=<id>`. ✕ and Esc close it.
 */
@Component({
  selector: 'app-app-picker-dialog',
  standalone: true,
  imports: [NgFor, NgIf, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './app-picker-dialog.component.html',
  styleUrls: ['./app-picker-dialog.component.scss'],
})
export class AppPickerDialogComponent implements OnInit {
  private readonly appsService = inject(AppsService);
  private readonly dialogRef = inject<MatDialogRef<AppPickerDialogComponent>>(MatDialogRef);
  private readonly router = inject(Router);

  /** `null` while loading (the catalog is cached, so usually only for the first open). */
  apps: AppDto[] | null = null;

  ngOnInit(): void {
    this.appsService.getApps().subscribe({
      next: (apps) => {
        this.apps = [...apps].sort((a, b) => a.order - b.order);
      },
      // The interceptor already shows the snackbar, and there is nothing to pick.
      error: () => this.dialogRef.close(),
    });
  }

  isAvailable(app: AppDto): boolean {
    return app.status === 'available';
  }

  /** Coming-soon tiles do nothing. */
  pick(app: AppDto): void {
    if (!this.isAvailable(app)) return;
    this.dialogRef.close();
    void this.router.navigate(['/zaps/new'], { queryParams: { appId: app.id } });
  }

  trackById(_index: number, app: AppDto): string {
    return app.id;
  }

  /** Opens the picker (header and empty-state **Create Zap**). */
  static open(dialog: MatDialog): MatDialogRef<AppPickerDialogComponent> {
    return dialog.open(AppPickerDialogComponent, { width: '720px', maxWidth: '95vw' });
  }
}
