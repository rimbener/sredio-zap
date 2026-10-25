# S6. Field mapping: insert field, preview, counter

- **Goal:** While writing the comment, a user can insert PR fields like `{{pr.author}}` and see a live preview with sample data.
- **Scope in:** **+ Insert field** `mat-menu` listing F1 tokens with labels, inserts at the cursor; live Preview using F2 `renderTemplate` with sample values; `n / 65536` counter (JS `length`); client-side "Unknown field {{x}}" error from `extractTokens`.
- **Scope out:** server-side unknown-token error mapped to the field (E8); truncation (E11).
- **Touches:** client: `zaps/zap-builder/action-step.component.*` only.
- **Depends on:** S5, F2
- **Doc refs:** Screens.md → Action card; Data-model.md → Field mapping.
- **Acceptance:** Karma: inserting a token at a cursor position in the middle of text; preview updates on input; counter counts an emoji as 2; `{{nope}}` shows the error and makes the form invalid. Manual: insert `{{pr.title}}`, preview shows "Fix login redirect".
- **Size:** S
