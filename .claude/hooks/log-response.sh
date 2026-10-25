#!/usr/bin/env bash
# Appends Claude's final text for the turn to docs/history.md (Stop hook).
input=$(cat)
history="${CLAUDE_PROJECT_DIR:-$(pwd)}/docs/history.md"
transcript=$(jq -r '.transcript_path // ""' <<<"$input")

# Prefer the field if this Claude Code version provides it; otherwise read the transcript.
response=$(jq -r '.last_assistant_message // empty' <<<"$input")
if [[ -z "$response" && -f "$transcript" ]]; then
  # Collect all assistant text blocks after the last real user prompt (ignoring tool results).
  response=$(jq -rs '
    (map(.type == "user" and (
        (.message.content | type) == "string" or
        ((.message.content | type) == "array" and any(.message.content[]; .type == "text"))
      )) | rindex(true)) as $start
    | .[($start // -1) + 1:]
    | map(select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text)
    | join("\n\n")
  ' "$transcript" 2>/dev/null)
fi

{
  printf '\n### 🤖 Claude — %s\n\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '%s\n' "${response:-_(no text response)_}"
} >>"$history"
exit 0
