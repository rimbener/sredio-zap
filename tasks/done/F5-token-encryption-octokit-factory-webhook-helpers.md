# F5. Token encryption, Octokit factory, webhook helpers

- **Goal:** Server code can encrypt secrets, talk to GitHub as a user, and create/remove a Zap's webhook, with a seam to mock GitHub in tests.
- **Scope in:**
  - `encrypt(plain) → EncryptedValue` / `decrypt(value)` with AES-256-GCM, random 12-byte IV, base64 fields, key from env.
  - `octokitFor(encryptedToken)`: decrypts in memory and returns an `Octokit`. A test override (`setOctokitFactory(fn)` / reset) so tests inject a fake.
  - `buildHookBody(zapId, secret, webhookPublicUrl)` exactly as API.md; `createWebhook(octokit, { owner, repo, zapId })` → `{ hookId, secret }` (fresh 32-byte secret) for the success path only; `removeWebhook(octokit, { owner, repo, hookId })` for the success path only.
- **Scope out:** GitHub error mapping (E3), 422 leftover-hook lookup (E4), best-effort/404 rules (E5).
- **Touches:** server: `src/crypto/token.ts`, `src/github/octokit.ts`, `src/github/webhooks.ts`.
- **Depends on:** — (reads the key through a function argument or `env.ts`; if `env.ts` isn't merged yet, take the key as a parameter).
- **Doc refs:** Tech-Stack.md → GitHub integration; API.md → Create-webhook routine (hook body only).
- **Acceptance (node:test):** encrypt/decrypt round trip; two encryptions of the same value differ (IV); tampered ciphertext or authTag throws; `buildHookBody` has `content_type: 'json'`, `insecure_ssl: '0'`, `events: ['pull_request']`, `active: true`, URL `…?zap=<id>`; `createWebhook` calls `repos.createWebhook` on the fake with that body and returns its id; secret is 32 random bytes.
- **Size:** M
