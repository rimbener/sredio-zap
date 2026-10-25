# Tech stack - MEAN stack
- MongoDB for persistence
- Node.js as the runtime
- Express on the server
- Angular for the front
- Typescript

The app runs locally only; it will not be deployed. Keep dependencies minimal: no middleware or library that isn't listed here.

## Runtime and language
| Item | Version | Notes |
|---|---|---|
| Node.js | 18.20.x | Angular 16's official version-compatibility table lists Node `^16.14 \|\| ^18.10`, and Express 5 needs `>=18`; Node 18 is the newest line inside Angular 16's official support. (The `engines` field, `^16.14.0 \|\| >=18.10.0`, would accept Node 20+, but that's untested by Angular.) Node 18 is EOL, accepted for this local project. Pin via `.nvmrc`. |
| TypeScript | ~5.1.6 | Angular 16 requires `>=4.9.3 <5.2`. Same version across the monorepo. |
| npm | 9/10 (bundled with Node 18) | npm workspaces. |

## Repository layout
npm workspaces monorepo:
- `/client`: Angular app
- `/server`: Express API + webhook receiver
- `/shared`: shared TS types and zod schemas (Zap, Trigger, Action, DTOs)

`/shared` compiles to `shared/dist` (plain JS + `.d.ts`), and both client and server import that build, so the server's `tsc` + `node dist` production build works unchanged. In development:
- `npm run dev:server` and `npm run dev:client` build `shared` once before starting, so a fresh clone runs.
- `npm run dev:shared` runs `tsc --watch` on `shared` in its own terminal. Edits are rebuilt into `dist`, which `tsx watch` and the Angular dev server pick up.
- Typical dev setup is three terminals: `dev:shared`, `dev:server`, `dev:client` (plus `smee` for webhooks).

## Client
| Package | Version | Notes |
|---|---|---|
| @angular/core, common, router, forms, platform-browser, animations | ~16.2.12 | Standalone components (no NgModules); `bootstrapApplication`, `provideRouter`, `provideHttpClient`. |
| @angular/cli, @angular-devkit/build-angular | ~16.2.16 | |
| @angular/material, @angular/cdk | ~16.2.14 | Prebuilt `indigo-pink` theme, no custom theming. |
| rxjs | ~7.8.2 | |
| zone.js | ~0.13.3 | |
| Testing | Angular CLI defaults | Karma + Jasmine, as scaffolded. |

## Server
| Package | Version | Notes |
|---|---|---|
| express | ^5.1 (latest 5.x) | |
| helmet | ^8.1 | Security headers. |
| cors | ^2.8.5 | Only the Angular dev origin is allowed, `credentials: true`. |
| express-session | ^1.18 | Cookie session named `zaps.sid` (httpOnly, sameSite=lax, `maxAge` 7 days). |
| connect-mongo | ^5.1.0 | Session store, `ttl` 7 days (matches the cookie). **Not v6**, which requires Node >=20.8. Reuses Mongoose's connection through **one shared promise**, so `mongoose.connect()` is called exactly once: `const conn = mongoose.connect(MONGODB_URI)`. Startup awaits `conn` before listening, and the store gets `MongoStore.create({ clientPromise: conn.then(m => m.connection.getClient()) })`. `getClient()` is only valid after `connect()` resolves, and the promise guarantees that order. npm may also install connect-mongo's `mongodb` peer (`>=5.1 <7`) as a separate copy; that's harmless because the store uses the client passed in. |
| passport | ^0.7.0 | `req.login` regenerates the session id itself (session-fixation protection); no manual `req.session.regenerate()`. |
| passport-github2 | ^0.1.12 | GitHub OAuth sign-in. Strategy configured with `state: true` (OAuth CSRF protection via the session). |
| mongoose | ^8 | |
| @octokit/rest | ^21.1.1 | Create repo webhooks, post PR comments. **Not v22**, which requires Node >=20. ESM-only. |
| zod | ^3.25 | Request validation; schemas live in `/shared`. **Not v4**, which needs TS >=5.5. |
| dotenv | ^18.0.9 | Loads `server/.env` (Node 18 has no `--env-file`, which arrived in Node 20.6). `import 'dotenv/config'` is the first import of the server entry; quiet mode on. Never overrides variables already set, so tests and the shell can set their own. |

No other middleware (no logger, compression, rate limiting, etc.). JSON body parsing uses the built-in `express.json()`; the webhook route uses `express.raw()` so the `X-Hub-Signature-256` HMAC can be verified with `node:crypto`.

Server build: ESM (`"type": "module"`, TS `module: NodeNext`). `tsx watch` for dev, `tsc` for build.

## Server dev / test
| Package | Version | Notes |
|---|---|---|
| tsx | ^4 | Dev runner. |
| smee-client | ^3.1.1 | Forwards GitHub webhooks to localhost and keeps the URL query string (used for per-Zap hook URLs). `npm run smee` runs `server/scripts/smee.ts`, which reads the channel from `WEBHOOK_PUBLIC_URL` in `.env` (one variable for both GitHub and smee). **Not v4/v5**, which require Node >=20. Caveat: it re-serializes the body with `JSON.stringify` instead of forwarding GitHub's exact bytes, so an HMAC mismatch is possible for some payloads (e.g. escaped unicode in a PR title). Test with non-ASCII PR titles; if it fails, switch tunnels. Never weaken the signature check. |
| node:test | built-in | Test runner. |
| supertest | ^7 | HTTP tests for the API and webhook handler. |
| mongodb-memory-server | ^10.4.3 | In-memory MongoDB for server tests, so tests don't need Docker. Default binary is MongoDB 7.0.24, matching the `mongo:7` container. The binary (~100 MB) downloads on first use and is cached. **Not v11**, which requires Node >=20.19. |
| @types/node | ^18 | |
| @types/express, @types/cors, @types/express-session, @types/passport, @types/passport-github2, @types/supertest | latest | |

### Testing approach (server)
- **Database:** each test file starts a `MongoMemoryServer`, connects Mongoose (and the session store) to its URI, clears collections before each test, and stops it at the end. No Docker needed to run tests; `NODE_ENV=test`.
- **Signed-in requests:** no real OAuth in tests. `createApp(options?)` accepts a test-only option, `authenticateAs?: (req) => UserDocument | null`. When passed, a middleware placed right after `passport.session()` sets `req.user`, so `requireAuth` (which checks `req.isAuthenticated()`) lets the request through. The production entry point never passes it. Tests for `401 UNAUTHENTICATED` build the app without it (or have it return `null`).
  - Consequence: tests don't exercise the real session cookie or the OAuth flow. Sign-in, sign-out and `endSession` are covered by unit tests of their handlers plus a manual check against real GitHub.
- **GitHub:** every GitHub API call goes through one factory, `getOctokit(token)`, in a single module. Tests swap it for a fake that records calls and returns canned responses or errors (e.g. 401, 403 with rate-limit headers, 422). No HTTP-level mocking library.

## GitHub integration
- One **GitHub OAuth App** handles both sign-in and events.
- OAuth scopes: `public_repo`, `admin:repo_hook`. Only public repos are supported. `admin:repo_hook` is still needed because `public_repo` doesn't cover webhooks, and removing a webhook needs `admin` (`write:repo_hook` can't delete). No `read:user`: the public profile from `GET /user` (id, login, name, avatar) needs no scope.
- Turning a Zap on creates a webhook on the chosen repo with the user's token: `events: ['pull_request']`, `config: { url: WEBHOOK_PUBLIC_URL + '?zap=<zapId>', content_type: 'json', secret, insecure_ssl: '0' }`, `active: true`.
  - `content_type: 'json'` is required; GitHub's default is form-encoded, which the receiver rejects.
  - The `?zap=<zapId>` makes each Zap's hook URL unique. GitHub refuses a second hook with the same URL and overlapping events on one repo, so a shared URL would block two Zaps on the same repo.
- Turning a Zap off or deleting it removes its webhook (best-effort; see [API.md](API.md#zaps)).
- The user's GitHub access token is stored server-side, encrypted, so webhooks can be managed and comments posted:
  - AES-256-GCM via `node:crypto` (no extra dependency).
  - 32-byte key from the `TOKEN_ENCRYPTION_KEY` env var (base64); the server refuses to start if it's missing or invalid.
  - Stored as `{ iv, authTag, ciphertext }` with a random 12-byte IV per encryption; decrypted only in memory right before a GitHub API call.
  - The token is never sent to the client or written to logs.

## Database
- MongoDB 7 in Docker (`docker-compose.yml`, image `mongo:7`), connection via the `MONGODB_URI` env var.

## Deferred
- Copilot LLM provider/SDK: decided when the nice-to-have is picked up.

