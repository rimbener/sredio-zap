# Zaps

A small workflow automation app inspired by Zapier's Zaps: a trigger plus an action. In this version one Zap works end to end: **when a pull request is opened on a GitHub repo, comment on that pull request.** Other apps (GitLab, Jira, Linear, Slack) appear in the app picker as "coming soon".

MEAN stack: MongoDB, Express 5, Angular 16 (+ Angular Material), Node 18, TypeScript. It runs **locally only**.

| Doc | What's in it |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements and scope |
| [docs/Tech-Stack.md](docs/Tech-Stack.md) | Versions, libraries, GitHub integration, testing approach |
| [docs/Data-model.md](docs/Data-model.md) | Collections, lifecycle rules, webhook processing |
| [docs/API.md](docs/API.md) | Endpoints, errors, webhook receiver, env vars |
| [docs/Screens.md](docs/Screens.md) | Routes, wireframes, builder behavior, error handling |
| [docs/Tasks.md](docs/Tasks.md) | Implementation plan (slices and waves) |

> **Status:** only the project boilerplate exists so far; the app itself isn't implemented yet (see [Tasks.md](docs/Tasks.md)). Until the relevant tasks land:
> - `npm run dev:server` starts the server skeleton (env validation, middleware, session store) with `GET /api/apps` and the webhook receiver `POST /webhooks/github`; the other routes arrive with the slices (sign-in: S1, Zaps: S3 onward).

## Prerequisites

- **Node 18.20** via [nvm](https://github.com/nvm-sh/nvm). The repo pins `18.20.8` in `.nvmrc`; Angular 16 doesn't officially support newer Node versions.
- **Docker** (Docker Desktop or similar) for the local MongoDB.
- A **GitHub account** and a **public repository where you're an admin**, to test with. Private repos aren't supported.

## Setup

### 1. Install

```sh
nvm install        # reads .nvmrc
nvm use
npm install        # installs all workspaces: shared, server, client
```

### 2. Start MongoDB

```sh
docker compose up -d
```

This runs `mongo:7` on `localhost:27017` with a named volume, so data survives restarts. Stop it with `docker compose down`; the data is kept.

### 3. Create a smee channel

GitHub can't reach `localhost`, so webhooks go through [smee.io](https://smee.io), which forwards them to your machine.

1. Open <https://smee.io/new>.
2. Copy the channel URL, e.g. `https://smee.io/AbC123xyz`. You'll put it in `.env` as `WEBHOOK_PUBLIC_URL`.

### 4. Register a GitHub OAuth App

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Fill in:
   - **Application name:** anything, e.g. `Zaps (local)`
   - **Homepage URL:** `http://localhost:4200`
   - **Authorization callback URL:** `http://localhost:3000/auth/github/callback`
3. Click **Register application**, then **Generate a new client secret**. Copy the **Client ID** and the **client secret** (it's shown only once).

You don't configure scopes in the OAuth App. The app asks for `public_repo` and `admin:repo_hook` when you sign in.

### 5. Configure `server/.env`

```sh
cp server/.env.example server/.env
```

Fill in the values (each one is explained in `server/.env.example` and in [API.md → Configuration](docs/API.md#configuration-env-vars)):

| Variable | Value |
|---|---|
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | From step 4 |
| `WEBHOOK_PUBLIC_URL` | Your smee channel URL from step 3 |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (must decode to exactly 32 bytes) |
| `PORT`, `CLIENT_URL`, `MONGODB_URI`, `GITHUB_CALLBACK_URL` | The defaults work as-is |

`server/.env` is git-ignored; never commit it. The server refuses to start if any variable is missing or invalid.

> If you ever change `TOKEN_ENCRYPTION_KEY`, the stored GitHub tokens and webhook secrets can't be decrypted anymore. Sign in again, and turn your Zaps off and on again.

### 6. Seed the app catalog

```sh
npm run seed -w server
```

This upserts the app picker's catalog (GitHub, plus GitLab, Jira, Linear and Slack as "coming soon") into MongoDB. Run it once after cloning, and again whenever the seed list in `/shared` changes.

## Running

Use four terminals, all from the repo root (run `nvm use` in each):

| Terminal | Command | What it does |
|---|---|---|
| 1 | `npm run dev:shared` | Rebuilds `/shared` on every change |
| 2 | `npm run dev:server` | API on <http://localhost:3000>, restarts on change |
| 3 | `npm run dev:client` | Angular app on <http://localhost:4200> |
| 4 | `npm run smee` | Forwards GitHub webhooks to `http://localhost:3000/webhooks/github` |

`dev:server` and `dev:client` build `/shared` once before starting, so they also work without terminal 1; you just won't get live updates when you edit `/shared`.

### Try your first Zap

1. Open <http://localhost:4200> and **Sign in with GitHub**.
2. Click **Create Zap** and pick **GitHub**.
3. In **Trigger**, pick your public test repo. Only public repos where you're an admin are listed.
4. In **Action**, keep or edit the comment. Use **Insert field** to add values from the pull request, such as `{{pr.author}}` or `{{pr.title}}`.
5. Click **Save**, then turn the Zap **on**. This creates a webhook on the repo.
6. Open a pull request on that repo. The comment appears on it within a few seconds.

## Tests

```sh
npm test                 # shared, then server, then client
npm test -w shared       # shared only
npm test -w server       # server only
npm test -w client       # client only (Karma, watch mode)
```

- **Server tests** use an in-memory MongoDB ([mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server)), so Docker isn't needed for tests. The first run downloads a MongoDB 7.0.24 binary (~100 MB) and caches it.
- **GitHub calls** are faked in tests, so no GitHub credentials are needed.
- **Client tests** run in Chrome; root `npm test` uses headless Chrome, so Chrome must be installed.

## Limitations

- **Public repos only**, and you must be an **admin** of the repo to add its webhook.
- **Organization repos** may be blocked if the organization restricts OAuth App access. An org owner has to approve the app (organization **Settings → Third-party Access → OAuth app policy**).
- **Local only:** the app isn't meant to be deployed.
- **Body size limit of 100 KB:** a Zap whose comment template is very long and mostly non-ASCII (emoji, CJK) can't be saved. A pull request with a huge non-ASCII description won't trigger the Zap.
- **No run history screen.** Runs are stored for 7 days and can be read from the API (see Troubleshooting).

## Troubleshooting

### A comment didn't appear: check the runs

While signed in, open `http://localhost:3000/api/zaps/<zapId>/runs` in the browser (the Zap's id is in the builder URL, `/zaps/<zapId>`). It lists the latest 50 runs with their `status` (`pending`, `success`, `failed`) and `error`.

Also check the delivery on GitHub: repo **Settings → Webhooks →** your hook **→ Recent Deliveries**.

### Retry a failed comment ("Redeliver")

If a run **failed** (for example GitHub had a temporary error), you can retry it:

1. On GitHub, open the repo's **Settings → Webhooks**.
2. Click the webhook whose URL is your smee channel with `?zap=<zapId>`.
3. Open **Recent Deliveries**, select the failed `pull_request` delivery, and click **Redeliver**.

Make sure `npm run smee` and the server are running. Redelivering a run that **succeeded** or is still **pending** does nothing, so the comment is never posted twice. There's one rare exception: if GitHub timed out or errored *after* creating the comment, the run was recorded as failed, and a redelivery posts a second comment.

### "This repo still has an old webhook from this Zap"

When a Zap is turned off or deleted, removing its webhook on GitHub is best-effort. If that failed, the old webhook stays on the repo and blocks turning the same Zap on again for that repo.

1. Click **Open webhook on GitHub** in the dialog, or go to the repo's **Settings → Webhooks** and find the hook whose URL ends in `?zap=<zapId>`.
2. Click **Delete**.
3. Turn the Zap on again, or save again if you were changing its repo.

Leftover webhooks of deleted Zaps don't trigger anything. You can delete them the same way to keep the repo tidy.

### Signature errors (`401`) in dev with non-ASCII PR titles

smee re-encodes the webhook body instead of forwarding GitHub's exact bytes, so the signature check can fail for some payloads, such as PR titles with emoji or accented characters. If you hit this, use a different tunnel that forwards the body unchanged. The signature check is never disabled.

### "Your GitHub session expired"

The app's GitHub token was revoked or expired, for example after you revoked the app under GitHub **Settings → Applications**. Sign in again. While the token is invalid, your Zaps can't post comments; those runs are recorded as `failed`.

## Project layout

```
client/   Angular 16 app (standalone components, Angular Material)
server/   Express 5 API + GitHub webhook receiver
shared/   Types, zod schemas and the template renderer, used by client and server
```

npm workspaces; one `package-lock.json` at the root. `/shared` compiles to `shared/dist`, which client and server import. `client/README.md` is the Angular CLI's generated readme.
