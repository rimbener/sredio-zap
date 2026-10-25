# E4. Leftover webhook: `409 WEBHOOK_EXISTS` and dialog

- **Goal:** If this Zap's old webhook is still on the repo, the user gets a dialog with a link to delete it on GitHub.
- **Scope in:** In `createWebhook`, on GitHub `422`: list `GET /repos/{owner}/{repo}/hooks?per_page=100` across all pages, look for `config.url === <this Zap's URL>`. Found → `409 WEBHOOK_EXISTS` with `details.hookSettingsUrl = https://github.com/{owner}/{repo}/settings/hooks/{id}`; the server doesn't touch that hook. No match or list failure → `502 GITHUB_ERROR`. Client: `ZapToggleService` opts out of the generic snackbar for this code and opens a `MatDialog` (toggle text from Screens.md, **Open webhook on GitHub** with `target="_blank" rel="noopener"`, **Close**); toggle reverts to off. Works on the list and the builder.
- **Scope out:** the Save-variant dialog text for repo moves (E6 reuses this dialog with a different message).
- **Touches:** server: `github/find-own-hook.ts` (new), `github/webhooks.ts` (one call site); client: `zaps/webhook-exists-dialog.component.*` (new, message passed in), `zaps/zap-toggle.service.ts`.
- **Depends on:** S8
- **Doc refs:** API.md → Errors (`WEBHOOK_EXISTS`), Create-webhook routine steps 2–3, enable sequence diagram; Data-model.md → Lifecycle rules; Screens.md → Error handling (`WEBHOOK_EXISTS`).
- **Acceptance:** supertest + mocked Octokit: create → 422, list returns the matching hook on **page 2** → 409 with the right URL, Zap stays disabled; list with no match → 502; list call fails → 502; a hook for a *different* Zap id on the same repo doesn't match. Karma: dialog opens with the link and toggle reverts. Manual (**real repo**): turn a Zap on, delete its document's `webhook` in mongosh and set `enabled: false` (simulating a failed removal), turn on again → dialog; delete the hook on GitHub → turning on works.
- **Size:** M
