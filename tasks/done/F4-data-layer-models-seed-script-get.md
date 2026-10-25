# F4. Data layer: models, seed script, `GET /api/apps`

- **Goal:** The app catalog is in Mongo and served to the client, and Zap/run models with their indexes exist for every slice.
- **Scope in:**
  - `App`, `Zap`, `ZapRun` Mongoose models with timestamps and all indexes from Data-model.md, including the `webhook.hookId` unique index with `partialFilterExpression: { 'webhook.hookId': { $type: 'number' } }`, and the 7-day TTL on `zapRuns.createdAt`.
  - Seed script `npm run seed -w server`: upserts F1's seed list by `key`.
  - Helpers: `toZapDto(doc)` (exposes `id`, never `userId` or `webhook`), `findOwnedZap(userId, id)` (invalid ObjectId or other owner → `404 NOT_FOUND`).
  - `GET /api/apps` sorted by `order` → `AppDto[]`. Client `AppsService` (fetch and cache).
  - Empty `routes/api/zaps/index.ts` for zap slices to register into.
- **Scope out:** any Zap endpoint.
- **Touches:** server: `src/models/{app,zap,zapRun}.ts`, `src/scripts/seed.ts`, `src/zaps/*`, `src/routes/api/apps.ts`, `src/routes/api/zaps/index.ts`, `package.json` (`seed` script); client: `core/apps.service.ts`.
- **Depends on:** F1, F3
- **Doc refs:** Data-model.md → `zaps` (indexes), `zapRuns` (indexes), `apps`; API.md → Apps, IDs.
- **Acceptance:**
  - node:test: seed is idempotent (run twice → 5 apps, `updatedAt` refreshed); two disabled Zaps with `webhook: null` both save (partial index); two Zaps with the same `hookId` fail; `findOwnedZap` returns 404 for another user's Zap and for `abc`; `toZapDto` omits `webhook`/`userId`.
  - supertest: `GET /api/apps` signed in → 5 apps in `order`; signed out → 401.
  - Karma: `AppsService` caches.
  - Manual: `npm run seed -w server`, then check `apps` in mongosh.
- **Size:** M
