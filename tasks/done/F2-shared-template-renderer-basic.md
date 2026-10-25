# F2. Shared template renderer (basic)

- **Goal:** One function turns a comment template plus token values into the comment text, used by the server and the builder preview.
- **Scope in:** `renderTemplate(template, values: Record<string, string>)`: plain `{{token}}` substitution, no expressions. Sample values for the preview (`octocat`, `42`, "Fix login redirect", …). A `buildTokenValues(prPayload)` that maps a `pull_request` payload to token values (`pr.body` → `''` when null).
- **Scope out:** truncation to 65,536 code points (E11).
- **Touches:** shared: `render.ts`, barrel line.
- **Depends on:** — (takes a plain values map, so it doesn't need F1's token list).
- **Doc refs:** Data-model.md → Field mapping; Screens.md → Action card (Preview).
- **Acceptance:** node:test unit tests: all 7 tokens substituted, repeated tokens, text without tokens unchanged, null PR body renders empty.
- **Size:** S
