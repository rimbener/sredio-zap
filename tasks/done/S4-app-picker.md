# S4. App picker

- **Goal:** Clicking **Create Zap** opens a dialog of apps where only GitHub can be picked, and picking it opens the builder.
- **Scope in:** `AppPickerDialogComponent` (`MatDialog`, tiles from `AppsService` in `order`, coming-soon tiles greyed with badge and `aria-disabled="true"`, not clickable, close with ✕/Esc). Picking an available app closes the dialog and navigates to `/zaps/new?appId=<id>`. Wire **Create Zap** on the list header and empty state.
- **Scope out:** `/zaps/new` with a bad `appId` (E9).
- **Touches:** client: `zaps/app-picker/*`, `zaps/zap-list/zap-list.component.ts` (`onCreate()`).
- **Depends on:** S3 (F4 for `AppsService`)
- **Doc refs:** Screens.md → App picker dialog, Navigation; PRD.md → app picker must-have.
- **Acceptance:** Karma: 5 tiles in order; clicking a coming-soon tile does nothing and it has `aria-disabled`; clicking GitHub navigates with its id; Esc closes. Manual: open from both the empty state and the header.
- **Size:** S
