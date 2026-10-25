import { NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { AppDto, ZapDto } from '@zaps/shared';
import { forkJoin } from 'rxjs';
import { AppsService } from '../../core/apps.service';
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

  state: ListState = 'loading';
  zaps: ZapDto[] = [];
  apps: AppDto[] = [];

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
  onCreate(): void {}

  /** Card toggle: enable/disable through `ZapToggleService` (S8). */
  onToggle(_event: ZapToggleEvent): void {}

  /** Card ⋮ → Edit: opens `/zaps/:id` (S7). */
  onEdit(_zap: ZapDto): void {}

  /** Card ⋮ → Delete: confirm, then `DELETE /api/zaps/:id` (S9). */
  onDelete(_zap: ZapDto): void {}

  trackById(_index: number, zap: ZapDto): string {
    return zap.id;
  }
}
