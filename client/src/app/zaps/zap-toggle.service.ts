import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ZapDto } from '@zaps/shared';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * The one place that turns Zaps on and off (list and builder), so toggle error handling
 * lives in one service (Tasks.md → Conflict notes). Emits the updated Zap, or errors with
 * the `ApiError` from the HTTP interceptor, which has already shown the snackbar.
 */
@Injectable({ providedIn: 'root' })
export class ZapToggleService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/zaps`;

  /** `POST /api/zaps/:id/enable` or `/disable`, with the empty JSON body the API expects. */
  setEnabled(zap: Pick<ZapDto, 'id'>, enabled: boolean): Observable<ZapDto> {
    return this.http.post<ZapDto>(`${this.url}/${zap.id}/${enabled ? 'enable' : 'disable'}`, {});
  }
}
