import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { CreateZapInput, PatchZapInput, ZapDto } from '@zaps/shared';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Zap CRUD calls (`/api/zaps`). Toggling goes through `ZapToggleService` (S8). */
@Injectable({ providedIn: 'root' })
export class ZapsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/zaps`;

  /** The signed-in user's Zaps, newest `updatedAt` first (server order). */
  list(): Observable<ZapDto[]> {
    return this.http.get<ZapDto[]>(this.url);
  }

  /** `POST /api/zaps`: the new Zap, always disabled. `context` can opt out of snackbars. */
  create(input: CreateZapInput, context?: HttpContext): Observable<ZapDto> {
    return this.http.post<ZapDto>(this.url, input, { context });
  }

  /** `DELETE /api/zaps/:id`: deletes the Zap, its runs and its webhook (`204`). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * `GET /api/zaps/:id`: one of the user's Zaps. `context` lets the caller opt out of
   * interceptor snackbars (`HANDLED_ERROR_CODES`), e.g. the builder's "Zap not found" state.
   */
  get(id: string, context?: HttpContext): Observable<ZapDto> {
    return this.http.get<ZapDto>(`${this.url}/${id}`, { context });
  }

  /** `PATCH /api/zaps/:id`: sends only the changed top-level fields; returns the saved Zap. */
  update(id: string, patch: PatchZapInput, context?: HttpContext): Observable<ZapDto> {
    return this.http.patch<ZapDto>(`${this.url}/${id}`, patch, { context });
  }
}
