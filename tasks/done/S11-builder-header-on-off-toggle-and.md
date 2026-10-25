# S11. Builder header: on/off toggle and Delete

- **Goal:** From the builder a user can turn the Zap on or off and delete it, without going back to the list.
- **Scope in:** Header toggle via `ZapToggleService`, disabled in create mode and while the form is dirty, with tooltip "Save your changes before turning this Zap on/off"; revert on error. ⋮ menu (edit mode only) with Delete → confirm dialog → DELETE → `/zaps`.
- **Scope out:** `WEBHOOK_EXISTS` dialog (E4, which lands in `ZapToggleService` and covers this toggle automatically).
- **Touches:** client: `zaps/zap-builder/zap-builder.component.*` (header).
- **Depends on:** S7, S8, S9
- **Doc refs:** Screens.md → Header bar (toggle, ⋮ menu).
- **Acceptance:** Karma: toggle disabled in create mode and when dirty (tooltip present); enabled when pristine in edit mode; Delete confirms then navigates. Manual: turn on from the builder, hook appears on GitHub.
- **Size:** S
