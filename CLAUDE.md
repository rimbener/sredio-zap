# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

"Zaps" is a local-only Zapier-style app with one working Zap: **when a PR is opened on a GitHub repo, comment on it**. Only the boilerplate exists so far; the app is built from the plan in `docs/Tasks.md` (foundation `F*`, happy-path slices `S*`, edge-case slices `E*`). The spec lives in `docs/` and is authoritative. Read the relevant one before implementing:

- `docs/PRD.md`: scope. `docs/Tech-Stack.md`: versions, libraries, testing approach, GitHub integration.
- `docs/Data-model.md`: collections, lifecycle rules, webhook processing / run dedupe.
- `docs/API.md`: endpoints, error envelope and codes, middleware order, env vars.
- `docs/Screens.md`: routes, builder behavior, client error handling, component layout.
- `docs/Tasks.md`: task breakdown, dependencies, and **Conflict notes** (which task owns which file). Gaps in the spec are listed under "Spec gaps"; don't invent behavior.

`docs/history.md` is a prompt/response log appended automatically by hooks in `.claude/hooks/`; don't edit it.

## Commands

Node 18.20.8 (`nvm use`); Angular 16 doesn't support newer Node. npm workspaces: `shared`, `server`, `client`.

```sh
docker compose up -d        # MongoDB 7 on localhost:27017
npm run dev:shared          # tsc --watch on /shared
npm run dev:server          # builds shared, then tsx watch (API on :3000)
npm run dev:client          # builds shared, then ng serve (:4200)
npm run smee                # forwards WEBHOOK_PUBLIC_URL (from server/.env) to :3000/webhooks/github
npm run build               # shared → server → client

npm test                    # all workspaces (client in headless Chrome)
npm test -w shared          # or -w server; client: npm test -w client (Karma watch)
cd server && node --import tsx --test src/path/to/file.test.ts      # single server/shared test file
cd client && npx ng test --watch=false --include src/app/path/x.spec.ts   # single client spec
```

Server config is `server/.env` (copy from `.env.example`); the server validates every var with zod at startup (`server/src/env.ts`: `loadEnv`/`getEnv`) and refuses to start otherwise. `npm run seed -w server` upserts the app catalog (`APPS_SEED` from `/shared`) by `key`; run it after cloning and whenever the seed list changes.

## Architecture

- **`/shared`** (`@zaps/shared`): zod schemas, DTOs, error codes, template tokens, apps seed list and the `{{token}}` template renderer. Compiles to `shared/dist`, which client and server import, so **rebuild shared** (or run `dev:shared`) after editing it. Each module gets one `export *` line in `shared/src/index.ts`.
- **`/server`**: Express 5, ESM (`"type": "module"`, `NodeNext`, so relative imports need `.js` extensions). `createApp(options?)` in `server/src/app.ts` owns the whole middleware chain in the exact order from API.md; route slices register one line in a router index instead of editing `app.ts`. Three route groups: `/auth` (passport-github2 OAuth), `/api` (session required, `requireJson` on POST/PATCH), `/webhooks` (HMAC-verified).
  - Webhook route uses `express.raw()` and is mounted **before** `express.json()` so `X-Hub-Signature-256` is verified on raw bytes (`timingSafeEqual`). Zaps are routed by `X-GitHub-Hook-ID`; the `?zap=<id>` query only makes hook URLs unique. Failed comments are recorded as `failed` runs, never a 5xx. Never weaken the signature check (smee can break it for non-ASCII bodies; that's a known limitation).
  - All GitHub calls go through a single `getOctokit(token)` factory in `server/src/github/octokit.ts` (`octokitFor(encrypted, key)` decrypts first); tests swap in a fake with `setOctokitFactory(fn)` / `resetOctokitFactory()`. Webhook create/remove and the hook body live in `server/src/github/webhooks.ts`, encryption in `server/src/crypto/token.ts`. User tokens and webhook secrets are AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`) and never sent to the client or logged.
  - Models live in `server/src/models/` (`User`, `App`, `Zap`, `ZapRun`). Zap routes are one router file per slice under `server/src/routes/api/zaps/`, registered with one line in its `index.ts`; they use the read-only helpers in `server/src/zaps/` (`toZapDto` never exposes `userId`/`webhook`; `findOwnedZap(userId, id)` → `404 NOT_FOUND` for invalid ids and other owners). New helpers go in new files.
  - Errors use one envelope `{ error: { code, message, details? } }`; new errors extend `AppError` with a code from `shared/src/errors.ts`. `GITHUB_AUTH_REQUIRED` ends the session via the shared `endSession` helper.
  - CSRF protection relies on strict `requireJson` + CORS limited to `CLIENT_URL`; keep both strict.
- **`/client`**: Angular 16 standalone components (no NgModules), Angular Material default `indigo-pink` theme. All routes are declared up front in `app.routes.ts` with `loadComponent`; slices fill in components rather than editing routes. A global HTTP error interceptor (`core/http-error.interceptor.ts`) adds `withCredentials`, rethrows failures as `ApiError` (`core/api-error.ts`) and shows the snackbar text from `core/error-messages.ts`; call sites that handle a code themselves opt out via the `HANDLED_ERROR_CODES` `HttpContextToken`. Auth state lives in `AuthService` (`GET /api/me` once, cached; `authGuard`/`guestGuard` in `core/auth.guards.ts`). `MatSnackBar` and `MatDialog` are provided app-wide in `app.config.ts` (Material 16 doesn't provide them in root); use `NotificationService` and `ConfirmDialogComponent.open()` rather than calling them directly. Zap on/off goes through one `ZapToggleService`.

## Constraints

- **Version pins are deliberate** (Node 18 / TS 5.1): TypeScript ~5.1.6, zod 3 (not 4), connect-mongo 5, @octokit/rest 21, smee-client 3, mongodb-memory-server 10. Don't upgrade.
- Keep dependencies minimal: no library or middleware not listed in `docs/Tech-Stack.md` (no logger, compression, rate limiting, HTTP mocking lib).
- Server tests: `node:test` + supertest + `mongodb-memory-server` (no Docker; first run downloads a ~100 MB binary). Call `useTestDb()` from `src/test/db.ts` at the top of a test file (sets a test env, starts Mongo, clears collections before each test); `createTestUser()` is in `src/test/users.ts`, `createTestZap(userId, overrides)` in `src/test/zaps.ts`, and `seedApps()` (`src/scripts/seed-apps.ts`) seeds the catalog. Signed-in requests use `createApp({ authenticateAs: () => user })` instead of real OAuth; GitHub is faked via the Octokit factory. Test files and `src/test/` are excluded from the build.

## Rules

- Use always conventional commits
- Check if it's needed to update this file and the README.md file every time a change is requested
- Never commit or push directly to `main` unless the user explicitly asks. Otherwise work on a feature branch (e.g. `feat/f1-shared-contracts`) and open a PR against `main`; never merge PRs, the user reviews and merges them
- Make no commits, pushes or PRs unless the user asks for them
- Keep PR descriptions short: what the PR implements, how it was verified, and the decisions taken where the spec is silent. Don't list every changed file
