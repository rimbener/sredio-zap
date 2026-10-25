# E12. Runs API for debugging

- **Goal:** A developer can see a Zap's last 50 runs through the API to debug failed comments.
- **Scope in:** `GET /api/zaps/:id/runs` → `ZapRunDto[]`, `createdAt` desc, limit 50, owner-scoped.
- **Scope out:** any run history UI (out of scope for this release).
- **Touches:** server: `routes/api/zaps/runs.ts` + registration.
- **Depends on:** F4
- **Doc refs:** API.md → Zaps (runs); Data-model.md → `zapRuns`, Revoked tokens.
- **Acceptance:** supertest: 60 runs → 50 newest in order; other user's Zap → 404; DTO fields only. Manual: `curl` with the session cookie after a demo PR.
- **Size:** S
