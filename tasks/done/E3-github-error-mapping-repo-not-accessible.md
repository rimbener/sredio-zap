# E3. GitHub error mapping: `REPO_NOT_ACCESSIBLE`, rate limits, `GITHUB_ERROR`

- **Goal:** When GitHub refuses an action, the user sees the right explanation (no access vs. GitHub trouble).
- **Scope in:** `mapGithubError(err)` in `github/errors.ts`: `401` → `GithubAuthRequiredError` (behavior in E2); `403` with `retry-after` or `x-ratelimit-remaining: 0` → `502 GITHUB_ERROR`; other `403` and `404` → `422 REPO_NOT_ACCESSIBLE` (create-webhook only); anything else → `502 GITHUB_ERROR`. Applied in `createWebhook` (enable) and the repos list. Client snackbars already exist in F6; verify texts.
- **Scope out:** the `422` leftover-hook branch (E4); disable/delete removal errors (E5).
- **Touches:** server: `github/errors.ts` (new), `github/webhooks.ts` (wrap call), `github/repos.ts` (wrap call).
- **Depends on:** S5, S8
- **Doc refs:** API.md → Errors table, Create-webhook routine step 4; Screens.md → Error handling (`REPO_NOT_ACCESSIBLE`, `GITHUB_ERROR`).
- **Acceptance:** node:test unit on the mapper with fake Octokit `RequestError`s for each case (403+`retry-after`, 403+remaining 0, plain 403, 404, 500, network). supertest + mocked Octokit: enable on 404 → 422 `REPO_NOT_ACCESSIBLE` and Zap stays disabled with `webhook: null`; rate-limit 403 → 502. Manual (**real GitHub**): save a Zap on a repo you don't admin (edit `trigger.config` in mongosh), turn it on → snackbar text.
- **Size:** M
