import { DatePipe, NgIf } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import {
  MatSlideToggle,
  MatSlideToggleChange,
  MatSlideToggleModule,
} from '@angular/material/slide-toggle';
import type { AppDto, ZapDto, ZapStep } from '@zaps/shared';

/** Emitted by the card's toggle: the Zap and the state the user asked for. */
export type ZapToggleEvent = { zap: ZapDto; enabled: boolean };

/**
 * One Zap on the list (Screens.md → Zap list → Card contents). The card only renders and
 * emits; the list owns the behavior (toggle: S8, delete: S9). Clicking the card anywhere
 * except the toggle or the ⋮ menu emits `edit`, like ⋮ → Edit.
 */
@Component({
  selector: 'app-zap-card',
  standalone: true,
  imports: [DatePipe, NgIf, MatButtonModule, MatCardModule, MatIconModule, MatMenuModule, MatSlideToggleModule],
  templateUrl: './zap-card.component.html',
  styleUrls: ['./zap-card.component.scss'],
})
export class ZapCardComponent implements OnChanges {
  @Input({ required: true }) zap!: ZapDto;
  /** The catalog from `GET /api/apps`, for the icon, app name and event names. */
  @Input() apps: AppDto[] = [];
  /** True while an enable/disable request for this Zap runs: the toggle is disabled (S8). */
  @Input() toggling = false;

  @ViewChild(MatSlideToggle) private slideToggle?: MatSlideToggle;

  @Output() readonly toggle = new EventEmitter<ZapToggleEvent>();
  @Output() readonly edit = new EventEmitter<ZapDto>();
  @Output() readonly delete = new EventEmitter<ZapDto>();

  /** The Zap's starting app (by `appId`, falling back to the trigger's app key). */
  get app(): AppDto | undefined {
    return this.apps.find((app) => app.id === this.zap.appId) ?? this.appFor(this.zap.trigger);
  }

  /** "Pull request opened in owner/repo → Comment on the pull request". */
  get summary(): string {
    const { owner, repo } = this.zap.trigger.config;
    const trigger = this.eventName(this.zap.trigger, 'triggers');
    const action = this.eventName(this.zap.action, 'actions');
    return `${trigger} in ${String(owner)}/${String(repo)} → ${action}`;
  }

  /**
   * When a toggle request ends, snap the switch back to `zap.enabled`. On success the new Zap
   * already matches; on error `zap.enabled` is unchanged, so the `[checked]` binding never fires
   * and the switch would stay where the user flipped it. This is the revert.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const toggling = changes['toggling'];
    if (toggling && !toggling.firstChange && !toggling.currentValue && this.slideToggle) {
      this.slideToggle.checked = this.zap.enabled;
    }
  }

  onToggle(change: MatSlideToggleChange): void {
    this.toggle.emit({ zap: this.zap, enabled: change.checked });
  }

  onEdit(): void {
    this.edit.emit(this.zap);
  }

  onDelete(): void {
    this.delete.emit(this.zap);
  }

  private appFor(step: ZapStep): AppDto | undefined {
    return this.apps.find((app) => app.key === step.app);
  }

  /** The event's display name from the catalog; the raw event key if it isn't listed. */
  private eventName(step: ZapStep, list: 'triggers' | 'actions'): string {
    return this.appFor(step)?.[list].find((event) => event.key === step.event)?.name ?? step.event;
  }
}
