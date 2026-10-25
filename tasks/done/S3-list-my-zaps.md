# S3. List my Zaps

- **Goal:** A signed-in user sees their Zaps as cards, newest first, with loading, empty and error states.
- **Scope in:**
  - `GET /api/zaps` scoped by `userId`, sorted `updatedAt` desc, optional `?appId=` filter (valid id only; invalid-id 400 is E9).
  - Client Zap list: grid, cards with app icon/name, summary "PR opened in `owner/repo` → Comment on PR" built from `/api/apps` event names and `trigger.config`, `DatePipe mediumDate`, a slide toggle showing `enabled` (not wired), a ⋮ menu (not wired), **Create Zap** button (not wired). Loading spinner, empty state, load error with Retry.
  - Placeholder app icons in `client/src/assets/` matching seed `icon` paths.
- **Scope out:** card click → edit (S7), toggle (S8), delete (S9), Create Zap → picker (S4), list `NOT_FOUND` handling (E9).
- **Touches:** server: `routes/api/zaps/list.ts` + registration; client: `zaps/zap-list/*`, `zaps/zaps.service.ts` (`list()`), `assets/apps/*`.
- **Depends on:** F4, F6
- **Doc refs:** API.md → Zaps (`GET /api/zaps`), Ownership; Screens.md → Zap list; Data-model.md → `zaps` indexes.
- **Acceptance:** supertest: returns only the session user's Zaps (seed two users), sorted by `updatedAt` desc, `?appId=` filters, no `webhook`/`userId` in the body. Karma: renders N cards from mocked services, empty state when `[]`, error state + Retry re-requests. Manual: insert a Zap in mongosh (or after S5) and see the card.
- **Size:** M
