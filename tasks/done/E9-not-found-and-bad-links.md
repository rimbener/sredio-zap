# E9. Not found and bad links

- **Goal:** Stale or mistyped links lead the user somewhere sensible instead of a broken screen.
- **Scope in:** Builder edit mode `NOT_FOUND` → "Zap not found" state with a link to `/zaps`. List actions (toggle/delete) on `NOT_FOUND` → snackbar "This Zap no longer exists", then reload. `/zaps/new` with missing/unknown `appId` or a `coming_soon` app → `/zaps` + snackbar. Server: invalid ObjectId in path → 404; `?appId=abc` → 400 `VALIDATION_ERROR`.
- **Scope out:** —
- **Touches:** client: `zaps/zap-builder/zap-builder.component.*`, `zaps/zap-list/zap-list.component.ts`; server: `routes/api/zaps/list.ts` (query validation), tests.
- **Depends on:** S3, S5, S7
- **Doc refs:** API.md → IDs, `GET /api/zaps?appId=`; Screens.md → Routes, States (404), Error handling (`NOT_FOUND`).
- **Acceptance:** supertest: `GET/PATCH/DELETE/enable /api/zaps/abc` → 404; `?appId=abc` → 400. Karma: builder shows the not-found state; `/zaps/new?appId=<gitlab id>` navigates to `/zaps` with a snackbar; list reloads after a 404 on toggle.
- **Size:** S
