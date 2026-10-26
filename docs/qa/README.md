# Manual QA: PRD coverage (2026-10-26)

A manual run in a real Chrome window against a live GitHub repo (`rimbener/zaps-qa-sandbox`), checking that every must-have in [PRD.md](../PRD.md) works end to end. Every check passed.

| PRD must-have | Result | Evidence |
|---|---|---|
| Sign in with GitHub | ✅ | Real OAuth login (scopes `public_repo admin:repo_hook`). Signed out, `/zaps` and the builder redirect to `/login` and the API returns 401. `?error=oauth` and `?error=github_auth` show their messages. Signed in, `/login` redirects to `/zaps`. `01-*`, `03-zaps` |
| Create a Zap: PR opened → comment on that PR | ✅ | Created from the app picker on `zaps-qa-sandbox`. `04-*`, `05-*` |
| A real PR gets the comment | ✅ | PR #1 got `Thanks @rimbener for "QA PR one" (#1) — QA run ✅ ñ`, and the run was recorded as `success`. `06-enabled` |
| Zaps belong to their owner | ✅ | Another user's Zap, added directly in Mongo: GET, PATCH, enable, DELETE and runs all return `404 NOT_FOUND`, and it isn't in the list. |
| List, create, edit: name, on/off, trigger, action, field mapping | ✅ | See below. `05-*`, `08-*`, `10-confirm` |
| App picker with coming-soon apps | ✅ | GitHub is clickable. GitLab, Jira, Linear and Slack have `aria-disabled="true"` and a "Coming soon" badge. A coming-soon or missing `appId` redirects to `/zaps` with a snackbar. `04-picker` |

**Builder:**
- Repo search ignores case, and typed text that isn't in the list is rejected.
- The name must be 1–100 characters.
- The comment starts with the default text, and has a character counter and a live preview.
- Insert field puts the token at the cursor, and an unknown token shows `Unknown field {{nope}}`.
- Leaving with unsaved changes asks for confirmation.
- Save is disabled when nothing changed, and the toggle is disabled in create mode and while there are unsaved changes.
- An edit PATCHes only the fields that changed. PR #2 got the edited comment.
- An unknown or invalid Zap id shows "Zap not found".

**Webhook:**
- Turning a Zap on creates the webhook (`pull_request`, JSON, sent to smee). Turning it off or deleting the Zap removes it. PR #3, opened while the Zap was off, got no comment.
- Closing and reopening a PR adds no comment.
- Redelivering the `opened` event created no second comment or run.

**Other:**
- Delete from the list and from the builder both ask for confirmation first.
- Sign out lands on `/login`, and `/api/me` then returns 401.
- `text/plain` and form POSTs return `415 UNSUPPORTED_MEDIA_TYPE`, which is the app's CSRF guard.

**Not covered:**
- The Copilot (nice-to-have, deferred in Screens.md).
- Cases that need GitHub in a broken state: a revoked token, `WEBHOOK_EXISTS`, and moving the repo of a Zap that's on. These are covered by automated tests.

## Scripts
`scripts/run.mjs` connects to a Chrome started with remote debugging, runs one test module and saves screenshots to `screenshots/`. Each test logs what it observed; they are exploratory scripts, not assertions. `playwright-core` isn't a project dependency (see Tech-Stack.md), so install it outside the repo.

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-qa http://localhost:4200/
npm i --prefix /tmp/pw playwright-core@1.47.2
PLAYWRIGHT=/tmp/pw/node_modules/playwright-core/index.mjs node docs/qa/scripts/run.mjs docs/qa/scripts/tests/01-signed-out.mjs
```

- Run `npm run dev` (with smee) and seed the catalog first.
- `02-signin` waits for you to finish the GitHub login in that window.
- `06`–`09` contain the Zap id from this run (`6adf2a86949ee18986354de3`), and `09` also uses the id of the other user's Zap. Update them before re-running.
- The GitHub side (opening, closing and reopening PRs, redelivering a webhook) and the other-user Zap were done with `gh` and `mongosh` between scripts.
