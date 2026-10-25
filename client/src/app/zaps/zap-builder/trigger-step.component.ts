import { NgFor, NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { AppDto, RepoDto } from '@zaps/shared';
import { TriggerForm, isRepo, sameRepo, type RepoValue } from './zap-form';

/** Step 1 of the builder: app (read-only), event and repository (Screens.md → Trigger card). */
@Component({
  selector: 'app-trigger-step',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './trigger-step.component.html',
  styleUrls: ['./step.scss'],
})
export class TriggerStepComponent {
  @Input({ required: true }) app!: AppDto;
  @Input({ required: true }) group!: TriggerForm;
  /** Loaded once by the builder; filtered here as the user types. */
  @Input() repos: RepoDto[] = [];
  /** Whether `repos` arrived; a list that failed to load doesn't count as "missing". */
  @Input() reposLoaded = false;
  @Input() expanded = false;

  /**
   * The current repo (e.g. a saved one in edit mode) isn't in the loaded list, for example
   * because the user lost admin rights (Screens.md → Trigger card).
   */
  get repoMissing(): boolean {
    const value = this.group.controls.repo.value;
    return this.reposLoaded && isRepo(value) && !this.repos.some((repo) => sameRepo(repo, value));
  }

  readonly displayRepo = (value: RepoValue): string => (isRepo(value) ? value.fullName : value ?? '');

  /** Repos whose `fullName` contains the typed text, case-insensitive. */
  get filteredRepos(): RepoDto[] {
    const query = this.displayRepo(this.group.controls.repo.value).trim().toLowerCase();
    return query ? this.repos.filter((repo) => repo.fullName.toLowerCase().includes(query)) : this.repos;
  }

  /** "Pull request opened in acme/api" once the step is valid. */
  get summary(): string | null {
    const { event, repo } = this.group.getRawValue();
    if (!this.group.valid || !isRepo(repo)) return null;
    const eventName = this.app.triggers.find((t) => t.key === event)?.name ?? event;
    return `${eventName} in ${repo.fullName}`;
  }
}
