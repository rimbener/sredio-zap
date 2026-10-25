import { HttpContext } from '@angular/common/http';
import type { AbstractControl } from '@angular/forms';
import type { ErrorCode, ValidationIssue } from '@zaps/shared';
import { ApiError } from '../../core/api-error';
import { HANDLED_ERROR_CODES } from '../../core/http-error.interceptor';
import { ZapForm } from './zap-form';

/**
 * Server validation errors on the builder's Save, shown on the field that caused them
 * (Screens.md → Error handling, `VALIDATION_ERROR`).
 */

/** Codes the builder's Save handles itself instead of the interceptor's snackbar. */
export const SAVE_HANDLED_ERROR_CODES: ErrorCode[] = ['VALIDATION_ERROR'];

/** The `HttpContext` for the builder's `POST /api/zaps` and `PATCH /api/zaps/:id`. */
export function saveContext(): HttpContext {
  return new HttpContext().set(HANDLED_ERROR_CODES, SAVE_HANDLED_ERROR_CODES);
}

/**
 * Request-body path prefix → form control. The longest matching prefix wins, so
 * `trigger.config.owner` and `trigger.config.repo` both land on the repo field.
 * Paths with no control (`appId`, `trigger.app`, a whole step, …) aren't mapped.
 */
const FIELD_PATHS: [prefix: string[], control: (form: ZapForm) => AbstractControl][] = [
  [['name'], (form) => form.controls.name],
  [['trigger', 'event'], (form) => form.controls.trigger.controls.event],
  [['trigger', 'config'], (form) => form.controls.trigger.controls.repo],
  [['action', 'event'], (form) => form.controls.action.controls.event],
  [['action', 'config'], (form) => form.controls.action.controls.body],
];

/** The form control for a zod issue's `path`, or `null` when no field shows it. */
export function controlForPath(form: ZapForm, path: readonly (string | number)[]): AbstractControl | null {
  let best: { length: number; control: AbstractControl } | null = null;
  for (const [prefix, control] of FIELD_PATHS) {
    const matches = prefix.length <= path.length && prefix.every((key, i) => path[i] === key);
    if (matches && (!best || prefix.length > best.length)) best = { length: prefix.length, control: control(form) };
  }
  return best?.control ?? null;
}

function isIssue(value: unknown): value is ValidationIssue {
  if (typeof value !== 'object' || value === null) return false;
  const { path, message } = value as Record<string, unknown>;
  return Array.isArray(path) && typeof message === 'string';
}

/**
 * Applies a `VALIDATION_ERROR`'s `details` to the form as field errors. Each mapped control
 * gets `{ zod: message }` (the key the builder's fields already render) and is marked touched
 * so it shows at once; the error clears when the user edits that field (validators re-run).
 *
 * Returns the snackbar text for what no field shows: the first unmapped issue's `message`,
 * or the error's own `message` when there are no usable `details`. `null` when every issue
 * landed on a field.
 */
export function applyValidationErrors(form: ZapForm, error: ApiError): string | null {
  const issues = Array.isArray(error.details) ? error.details.filter(isIssue) : [];
  if (issues.length === 0) return error.message || null;

  let unmapped: string | null = null;
  const applied = new Set<AbstractControl>();
  for (const issue of issues) {
    const control = controlForPath(form, issue.path);
    if (!control) {
      unmapped ??= issue.message;
      continue;
    }
    if (applied.has(control)) continue; // one message per field: the first issue's
    applied.add(control);
    control.setErrors({ ...control.errors, zod: issue.message });
    control.markAsTouched();
  }
  return unmapped;
}
