# E5. Robust disable/delete and enable guards

- **Goal:** A user can always turn off or delete a Zap even when GitHub fails, and repeated or invalid toggles behave predictably.
- **Scope in:** `removeWebhook` best-effort: GitHub `404` counts as removed; any other failure (including `401`) is swallowed (no session end) and local state wins for disable and delete. Enable on an already-enabled Zap → no-op `200` with no GitHub call; disable on a disabled Zap → no-op `200`. Enable when the Zap's app is `coming_soon` → `422 APP_UNAVAILABLE` (snackbar text from F6).
- **Scope out:** —
- **Touches:** server: `github/webhooks.ts` (`removeWebhook` only), `routes/api/zaps/toggle.ts`, `routes/api/zaps/delete.ts`.
- **Depends on:** S8, S9
- **Doc refs:** API.md → Disable/Delete, Enable (no-op, `APP_UNAVAILABLE`); Data-model.md → Lifecycle rules.
- **Acceptance:** supertest + mocked Octokit: disable with GitHub 404 / 500 / 401 → 200 `enabled: false`, `webhook: null`, session intact; delete with 500 → 204 and runs gone; double enable → one `createWebhook` call; Zap with a `coming_soon` `appId` (inserted directly) → 422. Manual (**real repo**): delete the hook on GitHub first, then turn the Zap off → no error.
- **Size:** S
