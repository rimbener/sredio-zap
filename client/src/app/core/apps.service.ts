import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { AppDto } from '@zaps/shared';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

/** The app catalog (`GET /api/apps`), fetched once and cached for the session. */
@Injectable({ providedIn: 'root' })
export class AppsService {
  private readonly http = inject(HttpClient);
  private apps$?: Observable<AppDto[]>;

  /** Apps sorted by `order`. One request for all subscribers; a failed request isn't cached. */
  getApps(): Observable<AppDto[]> {
    this.apps$ ??= this.http.get<AppDto[]>(`${environment.apiUrl}/api/apps`).pipe(
      catchError((error: unknown) => {
        this.apps$ = undefined;
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    return this.apps$;
  }
}
