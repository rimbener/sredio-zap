# S10. Webhook receiver posts the PR comment

- **Goal:** When a PR is opened on a repo with an enabled Zap, the Zap's comment appears on that PR.
- **Scope in:**
  - `POST /webhooks/github` with `express.raw({ type: 'application/json' })`, mounted before `express.json()` (F3 mount point).
  - Find Zap by `X-GitHub-Hook-ID`; unknown hook or disabled Zap → `204`.
  - Signature: header must match `sha256=` + 64 hex, else `401`; HMAC-SHA256 with the decrypted secret; length check, then `timingSafeEqual`; mismatch → `401`.
  - Not `pull_request` + `opened` (including `ping`) → `204`.
  - Insert `zapRun` (`pending`, `deliveryId`, `input: { prNumber, prUrl }`), render the body with F2 (`buildTokenValues`), post the comment with the owner's token, set `success` + `output.commentUrl` → `200`.
- **Scope out:** comment failure → `failed` run, duplicate delivery, retry of failed runs, stuck pending (E7); truncation (E11); runs API (E12).
- **Touches:** server: `routes/webhooks.ts`, `webhooks/verify-signature.ts`, `webhooks/handle-pull-request.ts`.
- **Depends on:** F2, F3, F4, F5
- **Doc refs:** API.md → Webhook receiver; Data-model.md → `zapRuns` (sequence diagram, happy branch); Tech-Stack.md → smee-client.
- **Acceptance:**
  - supertest + **mocked Octokit** (test inserts a Zap with an encrypted secret and `hookId`, signs a JSON fixture with that secret): valid `opened` → 200, one `success` run, `issues.createComment` called with the PR number and rendered body; bad signature → 401, no run; malformed header → 401; unknown hook id → 204; disabled Zap → 204; `ping` and `pull_request.closed` → 204, no run.
  - Unit: signature verify rejects wrong length without throwing.
  - Manual (**real repo + smee**, after S8): run `npm run smee`, open a PR on the test repo, the comment appears; one `success` run in `zapRuns`.
- **Size:** M
