import { TextFieldModule } from '@angular/cdk/text-field';
import { NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import {
  AppDto,
  COMMENT_BODY_MAX_LENGTH,
  SAMPLE_TOKEN_VALUES,
  TokenDef,
  extractTokens,
  formatToken,
  getTriggerTokens,
  renderTemplate,
} from '@zaps/shared';
import { ActionForm, ZapForm } from './zap-form';

/** Shows a field's error as soon as it's edited (typing or Insert field), not only after blur. */
const SHOW_WHEN_EDITED: ErrorStateMatcher = {
  isErrorState: (control) => !!control && control.invalid && (control.dirty || control.touched),
};

/**
 * Step 2 of the builder: event, comment body with Insert field, counter and a live preview
 * (Screens.md → Action card; Data-model.md → Field mapping).
 */
@Component({
  selector: 'app-action-step',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    ReactiveFormsModule,
    TextFieldModule,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
  ],
  templateUrl: './action-step.component.html',
  styleUrls: ['./step.scss', './action-step.component.scss'],
})
export class ActionStepComponent implements OnChanges, OnDestroy {
  /** The action's app (the Zap's app: GitHub is the only one with actions). */
  @Input({ required: true }) app!: AppDto;
  @Input({ required: true }) group!: ActionForm;
  @Input() expanded = false;

  @ViewChild('bodyInput', { static: true }) bodyInput!: ElementRef<HTMLTextAreaElement>;

  readonly maxLength = COMMENT_BODY_MAX_LENGTH;
  readonly errorStateMatcher = SHOW_WHEN_EDITED;
  readonly formatToken = formatToken;

  /** The group the unknown-token validator was added to, so it can be removed again. */
  private validatedGroup: ActionForm | null = null;

  /** "Unknown field {{x}}" for every placeholder the trigger doesn't expose. */
  private readonly unknownTokensValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const known = new Set(this.tokens.map((token) => token.key));
    const unknown = extractTokens(String(control.value ?? '')).filter((key) => !known.has(key));
    return unknown.length ? { unknownTokens: unknown.map((key) => `Unknown field ${formatToken(key)}`) } : null;
  };

  /** The trigger's tokens for the Insert field menu and the unknown-token check. */
  get tokens(): readonly TokenDef[] {
    const zap = this.group?.parent as ZapForm | null;
    const event = zap?.controls.trigger.controls.event.value ?? this.app?.triggers[0]?.key ?? '';
    return this.app ? getTriggerTokens(this.app.key, event) : [];
  }

  get body(): string {
    return this.group.controls.body.value;
  }

  get preview(): string {
    return renderTemplate(this.body, SAMPLE_TOKEN_VALUES);
  }

  /** Errors to show under the comment: the body schema's, else the unknown tokens. */
  get bodyErrors(): string[] {
    const control = this.group.controls.body;
    const zod = control.getError('zod') as string | null;
    if (zod) return [zod];
    return (control.getError('unknownTokens') as string[] | null) ?? [];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['group'] || changes['app']) this.attachValidator();
  }

  ngOnDestroy(): void {
    this.detachValidator();
  }

  /** Replaces the textarea's selection (or inserts at the cursor) with `{{key}}`, then puts the cursor after it. */
  insertToken(key: string): void {
    const textarea = this.bodyInput.nativeElement;
    const control = this.group.controls.body;
    const value = control.value;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? start;
    const token = formatToken(key);
    control.setValue(value.slice(0, start) + token + value.slice(end));
    control.markAsDirty();
    const cursor = start + token.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  }

  private attachValidator(): void {
    if (this.validatedGroup !== this.group) {
      this.detachValidator();
      this.group.controls.body.addValidators(this.unknownTokensValidator);
      this.validatedGroup = this.group;
    }
    this.group.controls.body.updateValueAndValidity();
  }

  private detachValidator(): void {
    if (!this.validatedGroup) return;
    this.validatedGroup.controls.body.removeValidators(this.unknownTokensValidator);
    this.validatedGroup.controls.body.updateValueAndValidity();
    this.validatedGroup = null;
  }
}
