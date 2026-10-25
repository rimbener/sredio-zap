# S9. Delete a Zap

- **Goal:** A user deletes a Zap from the card menu after confirming; its webhook and runs go with it.
- **Scope in:** `DELETE /api/zaps/:id` → remove webhook if present (F5, success path), delete the Zap and its `zapRuns` → `204`. Client ⋮ **Delete** opens `ConfirmDialogComponent` ("Delete *name*? Its GitHub webhook will be removed."), then calls DELETE and removes the card.
- **Scope out:** best-effort removal when GitHub fails (E5); builder Delete (S11); `NOT_FOUND` on a stale card (E9).
- **Touches:** server: `routes/api/zaps/delete.ts` + registration; client: `zaps/zap-list/*` (`onDelete()`), `zaps/zaps.service.ts` (`delete()`).
- **Depends on:** S3, F5
- **Doc refs:** API.md → Zaps (DELETE, Disable/Delete); Data-model.md → Lifecycle rules (deleting deletes `zapRuns`); Screens.md → Zap list (Delete).
- **Acceptance:** supertest + mocked Octokit: deletes Zap and only its runs (another Zap's runs stay); enabled Zap → `deleteWebhook` called; disabled Zap → no GitHub call; other user's → 404. Karma: cancel does nothing; confirm calls DELETE and removes the card; no native `confirm()`. Manual: delete an enabled Zap, hook disappears on GitHub.
- **Size:** S
