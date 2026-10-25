# S1. Sign in with GitHub

- **Goal:** A user clicks "Sign in with GitHub", authorizes the app, and lands on `/zaps` with their avatar in the toolbar.
- **Scope in:**
  - Passport `GitHubStrategy` with `state: true`, scopes `public_repo admin:repo_hook`.
  - `GET /auth/github`, `GET /auth/github/callback`: upsert user by `githubId` (login, name, avatar, encrypted token via F5), `req.login`, redirect to `CLIENT_URL/zaps`.
  - `GET /api/me` → `UserDto`.
  - Client: Login page (`mat-card`, button sets `window.location.href` to `${environment.apiUrl}/auth/github`); shell shows avatar and `login` in the menu.
- **Scope out:** `?error=oauth` / `?error=github_auth` messages and the failure redirect (E1); sign out (S2); revoked token (E2).
- **Touches:** server: `src/auth/github-strategy.ts`, `src/routes/auth.ts`, `src/routes/api/me.ts` + registration; client: `login/login.component.*`, `layout/shell.component.*` (avatar).
- **Depends on:** F1, F3, F5, F6
- **Doc refs:** API.md → Auth (+ sequence diagram), Current user; Data-model.md → `users`; Screens.md → Login, App shell, Routes; Tech-Stack.md → passport, passport-github2.
- **Acceptance:**
  - node:test: the strategy's verify callback (called directly with a fake profile and token) upserts by `githubId`, updates `login` on second sign-in, stores the token encrypted (stored value ≠ plain token, decrypts back).
  - supertest: `GET /auth/github` → 302 to `github.com/login/oauth/authorize` with both scopes and a `state`; `GET /api/me` with `authenticateAs` → `UserDto` with no `accessToken`; without session → 401.
  - Karma: Login button sets `window.location.href` (use a spy/wrapper); shell shows the avatar from `AuthService`.
  - Manual (real GitHub, O1 done): sign in, land on `/zaps`, refresh keeps the session, `users` has one document, `sessions` has one document.
- **Size:** M
