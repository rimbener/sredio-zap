# E6. Repo move on an enabled Zap

- **Goal:** A user can change the repo of a Zap that is on, and its webhook moves to the new repo.
- **Scope in:** PATCH on an enabled Zap whose `trigger.config` repo changes: (1) create the new hook with the create-webhook routine (E3 mapping, E4 409); (2) save Zap + new `webhook`; (3) remove the old hook best-effort (E5). Step 1 fails → nothing changes, error returned. Step 2 fails → remove the new hook best-effort, `500`. Builder: info banner "This Zap is on. Saving changes to the repository moves its webhook."; on `409` show the dialog with the Save text, keep the form dirty and its values.
- **Scope out:** —
- **Touches:** server: `routes/api/zaps/get-update.ts` (or a new `zaps/move-webhook.ts` it calls); client: `zaps/zap-builder/zap-builder.component.*`.
- **Depends on:** S7, S8, E3, E4
- **Doc refs:** API.md → Side effects (PATCH on an enabled Zap); Data-model.md → Lifecycle rules (repo move order); Screens.md → States (banner), Error handling (`WEBHOOK_EXISTS` Save variant).
- **Acceptance:** supertest + mocked Octokit: order of calls is create-new → save → delete-old; create-new 409/422/502 → Zap unchanged in DB, old hook not deleted; save failure (stub `Zap.save` to throw) → new hook deleted, 500; old-hook removal failure → still 200. Changing only the comment on an enabled Zap → no GitHub calls. Karma: banner shown only when enabled; 409 opens the Save dialog and the form stays dirty. Manual (**real repos + smee**): move from repo A to B, open a PR on B → comment; a PR on A → nothing.
- **Size:** M
