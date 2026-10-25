import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { ZapDto } from '@zaps/shared';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiError } from '../core/api-error';
import { HANDLED_ERROR_CODES } from '../core/http-error.interceptor';
import { WEBHOOK_EXISTS_TOGGLE_MESSAGE, WebhookExistsDialogComponent } from './webhook-exists-dialog.component';

/**
 * The one place that turns Zaps on and off (list and builder), so toggle error handling
 * lives in one service (Tasks.md → Conflict notes). Emits the updated Zap, or errors with
 * the `ApiError` from the HTTP interceptor, which has already shown the snackbar.
 * `WEBHOOK_EXISTS` opens the leftover-webhook dialog instead (E4); the caller's toggle
 * reverts to off on any error.
 */
@Injectable({ providedIn: 'root' })
export class ZapToggleService {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly url = `${environment.apiUrl}/api/zaps`;

  /** `POST /api/zaps/:id/enable` or `/disable`, with the empty JSON body the API expects. */
  setEnabled(zap: Pick<ZapDto, 'id'>, enabled: boolean): Observable<ZapDto> {
    const context = new HttpContext().set(HANDLED_ERROR_CODES, ['WEBHOOK_EXISTS']);
    return this.http
      .post<ZapDto>(`${this.url}/${zap.id}/${enabled ? 'enable' : 'disable'}`, {}, { context })
      .pipe(
        catchError((error: unknown) => {
          if (error instanceof ApiError && error.code === 'WEBHOOK_EXISTS') {
            WebhookExistsDialogComponent.open(this.dialog, error, WEBHOOK_EXISTS_TOGGLE_MESSAGE);
          }
          return throwError(() => error);
        }),
      );
  }
}
