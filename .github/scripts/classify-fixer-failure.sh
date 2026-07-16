#!/usr/bin/env bash
# Classify why the CodeRabbit auto-fixer run failed, so the workflow can decide
# whether an immediate restart is worth it.
#
# Reads ONLY the structured error fields of the Claude Code action's output JSON
# (.terminal_reason and .errors) — never the whole file, so prompt/feedback text
# (which may quote CodeRabbit comments containing words like "rate limit") cannot
# influence the classification.
#
# Inputs (env):
#   OUTPUT_FILE   path to claude-execution-output.json
#   GITHUB_OUTPUT provided by the runner
#
# Outputs (GITHUB_OUTPUT):
#   reason  one of: usage_limit | max_turns | other
#   reset   best-effort human-readable reset hint (may be empty)
set -euo pipefail

reason="other"
reset=""

if [[ -n "${OUTPUT_FILE:-}" && -f "${OUTPUT_FILE}" ]]; then
  terminal_reason="$(jq -r '.terminal_reason // ""' "${OUTPUT_FILE}" 2>/dev/null || true)"
  errors="$(jq -r '(.errors // []) | join(" ")' "${OUTPUT_FILE}" 2>/dev/null || true)"

  if printf '%s' "${errors}" | grep -qiE 'usage limit|rate limit|limit reached|too many requests|resets? at'; then
    reason="usage_limit"
    reset="$(printf '%s' "${errors}" | grep -oiE 'resets? at[^,"}]*' | head -n1 || true)"
  elif [[ "${terminal_reason}" == "max_turns" ]]; then
    reason="max_turns"
  fi
fi

{
  echo "reason=${reason}"
  echo "reset=${reset}"
} >> "${GITHUB_OUTPUT}"

echo "Fixer failure reason: ${reason}${reset:+ (resets: ${reset})}"
