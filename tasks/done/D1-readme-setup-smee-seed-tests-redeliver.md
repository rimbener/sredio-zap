# D1. README: setup, smee, seed, tests, "Redeliver"

- **Goal:** A new developer can clone, configure and run the app, and knows how to retry a failed comment.
- **Scope in:** Prereqs (Node 18.20 via `.nvmrc`, Docker); create the GitHub OAuth App (O1 steps, scopes, callback URL); smee channel and `npm run smee`; `.env` (how to generate `TOKEN_ENCRYPTION_KEY` and `SESSION_SECRET`); `docker compose up`, `npm run seed -w server`, dev commands (three terminals: `dev:shared`, `dev:server`, `dev:client`, plus `smee`); running tests (and the test DB); limits (public repos, admin rights, org OAuth restrictions); **Redeliver** steps (repo Settings → Webhooks → the hook → Recent Deliveries → Redeliver) and when it helps (failed runs only); leftover hooks and how to delete them; the smee non-ASCII caveat.
- **Scope out:** editing the existing spec `.md` files.
- **Touches:** root `README.md` (the Angular CLI also generated `client/README.md`; leave or replace it, decide in D1).
- **Depends on:** O1 to start; E7 and E11 to finalize.
- **Doc refs:** Data-model.md → Retrying a failed run ("the step goes in the project README"); Tech-Stack.md → smee-client, GitHub integration; API.md → Configuration.
- **Acceptance:** Someone following only the README on a clean machine reaches the first-demo flow.
- **Size:** S
- **Status:** Drafted as root `README.md` before implementation, with a status note listing the commands that land later (seed: F4; smee reading `.env`: F3). Finalize after F3, F4, E7 and E11: remove the status note and check every step on a clean machine. `client/README.md` (Angular CLI) is kept.
