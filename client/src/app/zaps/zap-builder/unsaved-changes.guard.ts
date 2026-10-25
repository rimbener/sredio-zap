import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanDeactivateFn, Router } from '@angular/router';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

/** What the guard needs from the builder: its form, `null` until it's built. */
export interface HasUnsavedChanges {
  form: { dirty: boolean } | null;
}

/**
 * Asks before leaving a dirty builder (Screens.md → Unsaved changes). A pristine
 * form leaves freely, so Save must `markAsPristine()` before navigating. Auth-driven
 * navigations to `/login` (`state.authRedirect`, set by the HTTP error interceptor)
 * pass without a dialog. No `beforeunload`.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component.form?.dirty) return true;
  const state = inject(Router).getCurrentNavigation()?.extras.state;
  if (state?.['authRedirect'] === true) return true;
  return ConfirmDialogComponent.open(inject(MatDialog), {
    title: 'Discard unsaved changes?',
    message: "Your changes to this Zap haven't been saved.",
    cancelLabel: 'Keep editing',
    confirmLabel: 'Discard',
  });
};
