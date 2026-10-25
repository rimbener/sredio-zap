# S5. Create a Zap in the builder

- **Goal:** A user names a Zap, picks one of their admin public repos, writes a comment and saves; the new Zap shows in their list (off).
- **Scope in:**
  - `GET /api/github/repos`: `GET /user/repos?visibility=public&affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100`, all pages, filtered to `permissions.admin === true`, mapped to `RepoDto`.
  - `POST /api/zaps`: zod (F1) + `appId` exists and its `key === trigger.app` → `201 ZapDto`, `enabled: false`, `webhook: null`.
  - Client builder, create mode: header (← back to `/zaps`, name input defaulting to "Untitled Zap", toggle disabled with tooltip, Save), trigger card (read-only app, event preselected, repo `mat-autocomplete` loaded once and filtered client-side, must be picked from the list), action card (event preselected, textarea with `cdkTextareaAutosize`, required, prefilled with `Thanks @{{pr.author}} for opening this pull request!`). Client validation with the shared zod schemas. Save: POST, `markAsPristine()`, then `navigate(['/zaps', id], { replaceUrl: true })`, "Saved" snackbar.
- **Scope out:** Insert field, preview, counter, inline unknown-token error (S6); edit mode (S7); server `VALIDATION_ERROR` → field mapping (E8); repos errors (E3, E2); bad `appId` in URL (E9); unsaved guard (E10).
- **Touches:** server: `routes/api/github-repos.ts`, `github/repos.ts`, `routes/api/zaps/create.ts` + registrations; client: `zaps/zap-builder/*` (new), `zaps/zaps.service.ts` (`create()`), `core/github.service.ts`.
- **Depends on:** F1, F4, F5, F6
- **Doc refs:** API.md → GitHub helpers, Zaps (POST), Validation; Screens.md → Zap builder (Form, Header bar, Trigger card, Action card minus Insert/Preview); Data-model.md → `zaps`.
- **Acceptance:**
  - supertest + **mocked Octokit**: repos endpoint follows pagination (2 pages), drops non-admin repos, keeps GitHub's order; POST valid body → 201 with `enabled: false`; `appId` of `gitlab` with `trigger.app: 'github'` → 400; unknown token → 400; another user can't see it (`GET /api/zaps` as user B).
  - Karma: Save disabled when pristine/invalid; free-text repo is invalid; Save calls POST, then marks pristine, then navigates (order checked with spies).
  - Manual (real GitHub): repo list shows only your admin public repos; save; Zap appears on `/zaps` as Off.
- **Size:** L
