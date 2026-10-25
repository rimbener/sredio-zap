# E2. Revoked GitHub token: `GITHUB_AUTH_REQUIRED` and `endSession`

- **Goal:** A user whose GitHub token was revoked is signed out and told to sign in again, instead of seeing GitHub errors.
- **Scope in:** E3's mapper turns GitHub `401` into a `GithubAuthRequiredError`; the error handler calls `endSession` before sending `401 GITHUB_AUTH_REQUIRED` (repos list, enable, PATCH repo move). Disable/delete swallow it (E5) and don't end the session. Client interceptor: set auth `null`, navigate to `/login?error=github_auth` with `authRedirect` state; login shows "Your GitHub session expired, please sign in again".
- **Scope out:** receiver comment `401` (recorded as `failed` in E7; no session to end).
- **Touches:** server: `errors/handler.ts`; client: `core/http-error.interceptor.ts`, `login/*`.
- **Depends on:** S2 (`endSession`), E3 (mapper)
- **Doc refs:** API.md → Errors (`GITHUB_AUTH_REQUIRED`), Conventions (Ending a session), Disable/Delete (401 rule); Screens.md → Login, Error handling; Data-model.md → Revoked tokens.
- **Acceptance:** supertest + mocked Octokit throwing 401: `GET /api/github/repos` → 401 `GITHUB_AUTH_REQUIRED`, cookie cleared, session gone, next `/api/me` → 401; enable → same; disable with 401 from GitHub → 200 and session still valid. Karma: interceptor navigation and login message. Manual (**real GitHub**): revoke the app in GitHub Settings → Applications, open the builder → back on login with the message.
- **Size:** M
