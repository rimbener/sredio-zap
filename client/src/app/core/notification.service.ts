import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Thin wrapper around `MatSnackBar` so call sites don't configure snackbars themselves. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  static readonly DURATION_MS = 5000;

  constructor(private readonly snackBar: MatSnackBar) {}

  show(message: string): void {
    this.snackBar.open(message, 'Close', { duration: NotificationService.DURATION_MS });
  }
}
