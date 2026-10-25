import { HttpClient } from '@angular/common/http';
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

  /** `POST /api/zaps`: the new Zap, always disabled. */
  create(input: CreateZapInput): Observable<ZapDto> {
    return this.http.post<ZapDto>(this.url, input);
  }

  /** `DELETE /api/zaps/:id`: deletes the Zap, its runs and its webhook (`204`). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** `GET /api/zaps/:id`: one of the user's Zaps. */
  get(id: string): Observable<ZapDto> {
    return this.http.get<ZapDto>(`${this.url}/${id}`);
  }

  /** `PATCH /api/zaps/:id`: sends only the changed top-level fields; returns the saved Zap. */
  update(id: string, patch: PatchZapInput): Observable<ZapDto> {
    return this.http.patch<ZapDto>(`${this.url}/${id}`, patch);
  }
}
