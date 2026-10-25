# S7. Edit a Zap

- **Goal:** A user opens a saved Zap from the list, changes its name, repo or comment, and saves.
- **Scope in:**
  - `GET /api/zaps/:id` and `PATCH /api/zaps/:id` (top-level merge, validate the merged Zap, `appId ↔ trigger.app`). For a **disabled** Zap, or an enabled Zap whose repo didn't change, just save.
  - Client: card click (outside toggle/menu) → `/zaps/:id`; builder edit mode loads Zap, apps and repos with a spinner; Save sends only changed top-level fields; "Saved" snackbar; form marked pristine.
- **Scope out:** repo change on an enabled Zap and the info banner (E6; until E6 lands, don't change the repo of an enabled Zap, see Spec gap 10); builder toggle and Delete (S11); 404 state (E9); validation mapping (E8); unsaved guard (E10).
- **Touches:** server: `routes/api/zaps/get-update.ts` + registration; client: `zaps/zap-builder/zap-builder.component.*` (edit mode), `zaps/zap-list/zap-card.component.*` (click), `zaps/zaps.service.ts` (`get()`, `update()`).
- **Depends on:** S5
- **Doc refs:** API.md → Zaps (GET/PATCH, Validation); Screens.md → Zap builder (Save edit mode, States initial load), Zap list (card click).
- **Acceptance:** supertest: GET own → 200, other user's → 404; PATCH `name` only keeps trigger/action; PATCH `trigger` replaces the whole step; PATCH that makes the merged Zap invalid (e.g. `trigger.app` mismatch) → 400; `updatedAt` changes. Karma: edit mode loads, PATCH body contains only changed fields. Manual: rename a Zap, list order updates.
- **Size:** M
