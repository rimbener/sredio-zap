# E7. Receiver: failed runs, duplicate deliveries, retry

- **Goal:** A PR never gets the same comment twice from one delivery, and a failed comment can be retried with GitHub's "Redeliver".
- **Scope in:** Comment post fails → run `failed` with `error`, receiver still `200` (never `5xx`). Duplicate key on `deliveryId` → atomic `findOneAndUpdate({ deliveryId, status: 'failed' }, { status: 'pending', error: null })`; matched → continue and post; not matched (`success` or `pending`) → `200` skip. Stuck `pending` is never retried.
- **Scope out:** README "Redeliver" steps (D1).
- **Touches:** server: `webhooks/handle-pull-request.ts`.
- **Depends on:** S10
- **Doc refs:** Data-model.md → `zapRuns` (sequence diagram, Deduplication, Retrying a failed run, Stuck pending, Response timing); API.md → Webhook receiver (responses).
- **Acceptance:** supertest + mocked Octokit: comment throws → 200, run `failed` with message; same delivery again after a `success` → 200, no second comment; after `failed` → comment posted, run `success`; a `pending` run + redelivery → 200, no comment; two concurrent identical deliveries (`Promise.all`) → exactly one `createComment` call. Manual (**real repo + smee**): revoke nothing, just use GitHub's Redeliver on a successful delivery → no duplicate comment; break the token (e.g. revoke) → failed run, restore by signing in again, Redeliver → comment appears.
- **Size:** M
