# E1. Sign-in failures and expired sessions

- **Goal:** A user whose sign-in fails sees a clear message, and a user whose session expired is sent back to login instead of seeing errors.
- **Scope in:** Callback failure, denial or `state` mismatch → redirect `CLIENT_URL/login?error=oauth`; login shows "Sign-in failed. Please try again." Interceptor on `UNAUTHENTICATED`: set auth `null`, navigate to `/login` with `{ state: { authRedirect: true } }`.
- **Scope out:** `GITHUB_AUTH_REQUIRED` (E2).
- **Touches:** server: `routes/auth.ts` (failure redirect); client: `login/*`, `core/http-error.interceptor.ts`.
- **Depends on:** S1
- **Doc refs:** API.md → Auth (callback failure); Screens.md → Login (`?error=oauth`), Error handling (`UNAUTHENTICATED`), Unsaved changes (authRedirect state).
- **Acceptance:** supertest: callback with a mismatched/missing `state` → 302 to `/login?error=oauth`; callback with `error=access_denied` → same. Karma: login shows the message only with the query param; interceptor on a 401 `UNAUTHENTICATED` sets `null` and navigates with `authRedirect`. Manual: delete the session in mongosh, click anything → login.
- **Size:** S
