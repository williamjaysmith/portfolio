#!/usr/bin/env bash
# Non-blocking fallow info hook. Fires after Write/Edit tool calls and prints a
# one-line drift report to stderr if `complexity_introduced` / `dead_code_introduced`
# / `duplication_introduced` is non-zero on the current branch. Rate-limited to one
# run per N seconds so it doesn't fire on every keystroke.
#
# This is INFORMATIONAL — never blocks. The real gate runs at commit-time
# (.claude/hooks/fallow-gate.sh). Goal: surface fallow drift mid-build instead
# of as a 60-finding cleanup pass at the end. See `.claude/rules/quality-bars.md`.

set -euo pipefail

# Cool-off so this doesn't fire on every keystroke. Skips if a run completed
# within the last MIN_INTERVAL seconds (default 60).
MIN_INTERVAL="${FALLOW_INFO_MIN_INTERVAL:-60}"
STAMP_FILE="${TMPDIR:-/tmp}/fallow-info.stamp"

if [ -f "$STAMP_FILE" ]; then
  LAST=$(stat -f %m "$STAMP_FILE" 2>/dev/null || stat -c %Y "$STAMP_FILE" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  if [ "$((NOW - LAST))" -lt "$MIN_INTERVAL" ]; then
    exit 0
  fi
fi

# Need jq + a fallow runner; fail open (silent) if missing.
if ! command -v jq >/dev/null 2>&1; then exit 0; fi

if command -v fallow >/dev/null 2>&1; then
  RUNNER=(fallow)
elif command -v npx >/dev/null 2>&1 && npx --no-install fallow --version >/dev/null 2>&1; then
  RUNNER=(npx --no-install fallow)
else
  exit 0
fi

# Update stamp BEFORE running so a slow audit doesn't queue duplicates.
touch "$STAMP_FILE"

JSON=$("${RUNNER[@]}" audit --format json --quiet 2>/dev/null || true)
if [ -z "$JSON" ]; then exit 0; fi

DEAD=$(echo "$JSON" | jq -r '.attribution.dead_code_introduced // 0')
COMPLEX=$(echo "$JSON" | jq -r '.attribution.complexity_introduced // 0')
DUP=$(echo "$JSON" | jq -r '.attribution.duplication_introduced // 0')

if [ "$DEAD" = "0" ] && [ "$COMPLEX" = "0" ] && [ "$DUP" = "0" ]; then
  exit 0
fi

# Print to stderr only — never blocks.
echo "fallow-info: branch drift — dead-code:$DEAD complexity:$COMPLEX duplication:$DUP (see .claude/rules/quality-bars.md). Run: npx fallow audit --changed-since main --explain" >&2
exit 0
