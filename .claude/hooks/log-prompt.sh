#!/usr/bin/env bash
# Appends the user's prompt to docs/prompt-history.md (UserPromptSubmit hook).
input=$(cat)
history="${CLAUDE_PROJECT_DIR:-$(pwd)}/docs/prompt-history.md"
session=$(jq -r '.session_id // "unknown"' <<<"$input")
prompt=$(jq -r '.prompt // ""' <<<"$input")

{
  printf '\n---\n\n### 🧑 User — %s (session `%s`)\n\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${session:0:8}"
  printf '%s\n' "$prompt"
} >>"$history"
exit 0
