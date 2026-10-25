# S2. Sign out

- **Goal:** A signed-in user picks **Sign out** in the avatar menu and is back on the login screen with no session.
- **Scope in:** `endSession(req, res)` helper (await `req.logout`, then `req.session.destroy`, then `clearCookie('zaps.sid')`, then respond). `POST /auth/logout` with `requireJson` → `204`. Client menu item calls it with `{}`, sets auth to `null`, navigates to `/login`.
- **Scope out:** using `endSession` for `GITHUB_AUTH_REQUIRED` (E2).
- **Touches:** server: `src/auth/end-session.ts`, `src/routes/auth.ts` (append route); client: `layout/shell.component.*`, `core/auth.service.ts` (`logout()`).
- **Depends on:** S1
- **Doc refs:** API.md → Conventions (Ending a session), Auth (`POST /auth/logout`); Screens.md → App shell.
- **Acceptance:** supertest: logout → 204, `Set-Cookie` clears `zaps.sid`, the session document is gone, next `GET /api/me` with the old cookie → 401; `text/plain` body → 415. Karma: menu click calls the service, then navigates to `/login`. Manual: sign out, back button doesn't show Zaps.
- **Size:** S
