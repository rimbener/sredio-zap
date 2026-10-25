# S8. Turn a Zap on and off

- **Goal:** Flipping a Zap's toggle on the list creates its GitHub webhook (on) or removes it (off).
- **Scope in:**
  - `POST /api/zaps/:id/enable`: load owned Zap, create webhook with F5 (`?zap=<id>` URL, fresh secret), store `webhook: { hookId, secret: encrypt(secret) }`, `enabled: true` → `ZapDto`.
  - `POST /api/zaps/:id/disable`: remove webhook with F5, set `webhook: null`, `enabled: false`.
  - Client `ZapToggleService` (calls enable/disable, returns the updated Zap or an `ApiError`); list toggle disabled while the request runs, reverts on error (generic snackbar from F6).
- **Scope out:** GitHub error mapping (E3); leftover hook 409 (E4); best-effort removal, already-on/off no-ops, `APP_UNAVAILABLE` (E5); revoked token (E2); builder toggle (S11).
- **Touches:** server: `routes/api/zaps/toggle.ts` + registration; client: `zaps/zap-toggle.service.ts`, `zaps/zap-list/*` (`onToggle()`).
- **Depends on:** S3, F4, F5
- **Doc refs:** API.md → Zaps (Enable, Disable, Create-webhook routine success path, sequence diagram); Data-model.md → Lifecycle rules, state diagram; Tech-Stack.md → GitHub integration.
- **Acceptance:**
  - supertest + **mocked Octokit**: enable calls `createWebhook` with the documented body for `trigger.config.owner/repo`, stores `hookId` and an encrypted secret, response has no `webhook`; disable calls `deleteWebhook` with the stored id and clears `webhook`; another user's Zap → 404.
  - Karma: toggle disabled during request; on success uses the returned `enabled`; on error reverts.
  - Manual (**real repo**): toggle on → hook appears in repo Settings → Webhooks with `?zap=<id>` URL, JSON content type, `pull_request` event, and a green `ping`; toggle off → hook gone.
- **Size:** M
