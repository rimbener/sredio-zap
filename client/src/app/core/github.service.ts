import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { RepoDto } from '@zaps/shared';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** GitHub helper endpoints (API.md → GitHub helpers). */
@Injectable({ providedIn: 'root' })
export class GithubService {
  private readonly http = inject(HttpClient);

  /** The user's public repos where they're an admin, most recently pushed first. Not cached. */
  getRepos(): Observable<RepoDto[]> {
    return this.http.get<RepoDto[]>(`${environment.apiUrl}/api/github/repos`);
  }
}
