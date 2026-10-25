# F1. Shared contracts: schemas, DTOs, tokens, apps seed list

- **Goal:** Server and client share one source of truth for request validation, response types, placeholder tokens and the app catalog.
- **Scope in:**
  - DTO types: `UserDto`, `AppDto`, `ZapStep`, `ZapDto`, `ZapRunDto`, `RepoDto`, `EncryptedValue`.
  - Step config registry keyed by `app + event`: `github / pull_request.opened` → `{ owner, repo }`; `github / pull_request.comment` → `{ body }` (1–65,536, JS `length`). Unknown pair is rejected.
  - `createZapSchema` (`{ appId, name, trigger, action }`) and `patchZapSchema` (any of those), plus a `validateZap(merged)` function for the merged Zap: config by registry, name 1–100, every `{{token}}` in action string fields is in the trigger's token list. (The `appId ↔ trigger.app` check needs the DB, so the server does it.)
  - Token list for `github / pull_request.opened` (`pr.number`, `pr.title`, `pr.body`, `pr.url`, `pr.author`, `repo.name`, `repo.fullName`) with display labels for the Insert field menu, and an `extractTokens(template)` helper.
  - Objectid-string schema for `?appId=` and path ids.
  - Apps seed list (5 apps: github available; gitlab, jira, linear, slack coming soon) with `key`, `name`, `icon`, `status`, `order`, `triggers`, `actions`.
- **Scope out:** renderer (F2), error codes (F3 owns `errors.ts`), DB-level checks (F4/S5).
- **Touches:** shared: `schemas/`, `dto.ts`, `tokens.ts`, `apps.seed.ts`, barrel line.
- **Depends on:** —
- **Doc refs:** Data-model.md → `zaps` (Trigger / action shape, Field mapping), `apps`, Shared type `EncryptedValue`; API.md → DTOs, Validation (POST and PATCH).
- **Acceptance:**
  - `npm run build -w shared` passes; server and client can import from `@zaps/shared`. With `npm run dev:shared` running, an edit in `/shared` is picked up by `dev:server` and `dev:client` without a restart (Tech-Stack.md → Repository layout).
  - node:test unit tests in shared (run via the server test runner or a shared `test` script): valid/invalid configs per pair, unknown pair rejected, name bounds, body 65,536 OK / 65,537 rejected (UTF-16 length), unknown token rejected, known tokens accepted, `extractTokens` handles adjacent and malformed braces.
- **Size:** M
