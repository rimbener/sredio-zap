# E8. Validation errors mapped to builder fields

- **Goal:** When the server rejects a Zap, the user sees the error on the field that caused it.
- **Scope in:** Builder Save/PATCH opt out of the generic snackbar for `VALIDATION_ERROR`; map `details[].path` (zod issues) to form controls (`name`, `trigger.config.repo`, `action.config.body`, …) as field errors; unmapped paths → snackbar with `message`. Server tests covering each validation rule end to end, plus `415` on the zap routes.
- **Scope out:** client-side zod checks (already in S5/S6).
- **Touches:** client: `zaps/zap-builder/form-errors.ts` (new), `zap-builder.component.ts` (call it); server: tests only.
- **Depends on:** S5, S7
- **Doc refs:** API.md → Errors (`VALIDATION_ERROR`), Validation; Screens.md → Error handling (`VALIDATION_ERROR`), Form.
- **Acceptance:** supertest: POST/PATCH with name of 101 chars, empty body, body 65,537 chars, unknown token, unknown `app + event`, `appId` mismatch → 400 with `details[].path`; `text/plain` → 415. Karma: a 400 with `path: ['action','config','body']` sets an error on that control; unknown path → snackbar.
- **Size:** M
