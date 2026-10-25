# E10. Unsaved-changes guard

- **Goal:** A user who leaves the builder with unsaved edits is asked before losing them.
- **Scope in:** `unsavedChangesGuard` (`CanDeactivateFn`) on `/zaps/new` and `/zaps/:id`: dirty form → `ConfirmDialogComponent` "Discard unsaved changes?" with **Keep editing** / **Discard**; navigations with `state.authRedirect` pass without asking. No `beforeunload`.
- **Scope out:** —
- **Touches:** client: `zaps/zap-builder/unsaved-changes.guard.ts`, `app.routes.ts` (two lines).
- **Depends on:** S7, E1 (the `authRedirect` state)
- **Doc refs:** Screens.md → Unsaved changes, Header bar (Save order), Routes.
- **Acceptance:** Karma: clean form → allowed; dirty + Keep editing → blocked; dirty + Discard → allowed; dirty + `authRedirect` → allowed with no dialog; after create-mode Save no dialog appears (pristine before navigate). Manual: edit, click ←, dialog appears.
- **Size:** S
