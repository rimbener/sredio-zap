import { NgIf } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ApiError } from '../core/api-error';

/** Dialog text when the 409 came from the on/off toggle (list or builder). Screens.md → Error handling. */
export const WEBHOOK_EXISTS_TOGGLE_MESSAGE =
  'This repo still has an old webhook from this Zap. Delete it on GitHub, then turn the Zap on again.';

export interface WebhookExistsDialogData {
  /** Depends on where the 409 came from (toggle here; builder Save in E6). */
  message: string;
  /** `details.hookSettingsUrl` from the `WEBHOOK_EXISTS` error. */
  hookSettingsUrl: string | null;
}

/**
 * `409 WEBHOOK_EXISTS` (Screens.md → Error handling): this Zap's old webhook is still on the
 * repo. Links to it on GitHub so the user can delete it there; no automatic retry.
 */
@Component({
  selector: 'app-webhook-exists-dialog',
  standalone: true,
  imports: [NgIf, MatButtonModule, MatDialogModule],
  template: `
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Close</button>
      <a
        *ngIf="data.hookSettingsUrl"
        mat-flat-button
        color="primary"
        [href]="data.hookSettingsUrl"
        target="_blank"
        rel="noopener"
        cdkFocusInitial
      >
        Open webhook on GitHub
      </a>
    </mat-dialog-actions>
  `,
})
export class WebhookExistsDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) readonly data: WebhookExistsDialogData) {}

  /** Opens the dialog for a `WEBHOOK_EXISTS` error with the given text. */
  static open(dialog: MatDialog, error: ApiError, message: string): MatDialogRef<WebhookExistsDialogComponent> {
    return dialog.open<WebhookExistsDialogComponent, WebhookExistsDialogData>(WebhookExistsDialogComponent, {
      data: { message, hookSettingsUrl: hookSettingsUrlOf(error) },
    });
  }
}

/** `details.hookSettingsUrl`, only when it's an https GitHub URL (it's used as a link). */
export function hookSettingsUrlOf(error: ApiError): string | null {
  const details = error.details as { hookSettingsUrl?: unknown } | undefined;
  const url = details?.hookSettingsUrl;
  return typeof url === 'string' && url.startsWith('https://github.com/') ? url : null;
}
