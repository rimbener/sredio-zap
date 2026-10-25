# O1. Create the GitHub OAuth App, smee channel and local `.env`

- **Goal:** A developer has real GitHub credentials and a public webhook URL to run the app locally.
- **Scope in:** Register one GitHub OAuth App (homepage `http://localhost:4200`, callback `http://localhost:3000/auth/github/callback`); create a smee.io channel; generate `SESSION_SECRET` and a 32-byte base64 `TOKEN_ENCRYPTION_KEY`; fill `.env` from `.env.example`; pick or create a **public test repo** you admin.
- **Scope out:** README write-up (D1).
- **Touches:** local `.env` only (not committed).
- **Depends on:** —
- **Doc refs:** Tech-Stack.md → GitHub integration; API.md → Configuration.
- **Acceptance:** Server starts with the env (after F3). The smee URL is reachable. Steps captured for D1.
- **Size:** S
