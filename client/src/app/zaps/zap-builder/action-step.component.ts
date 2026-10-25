import { TextFieldModule } from '@angular/cdk/text-field';
import { NgFor } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { AppDto } from '@zaps/shared';
import { ActionForm } from './zap-form';

/**
 * Step 2 of the builder: event and comment body (Screens.md → Action card).
 * Insert field, preview and the counter are S6.
 */
@Component({
  selector: 'app-action-step',
  standalone: true,
  imports: [NgFor, ReactiveFormsModule, TextFieldModule, MatExpansionModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './action-step.component.html',
  styleUrls: ['./step.scss'],
})
export class ActionStepComponent {
  /** The action's app (the Zap's app: GitHub is the only one with actions). */
  @Input({ required: true }) app!: AppDto;
  @Input({ required: true }) group!: ActionForm;
  @Input() expanded = false;
}
