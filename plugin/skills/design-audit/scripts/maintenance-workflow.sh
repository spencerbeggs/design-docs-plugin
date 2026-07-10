#!/usr/bin/env bash
set -euo pipefail

# Maintenance workflow for design documentation
# Identifies stale docs and generates maintenance report

# Resolve user-project root via env vars set by the SessionStart hook /
# host, with git-toplevel and cwd as fallbacks. Never dirname-walk from
# this script's location — that lands inside the plugin install.
PROJECT_DIR="${DESIGN_DOCS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [ -z "$PROJECT_DIR" ]; then
  PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
DESIGN_DIR="$PROJECT_DIR/.claude/design"

# Resolve plugin install root for sibling-skill reference.
# Dirname-walk is the standalone-invocation fallback only.
PLUGIN_ROOT="${DESIGN_DOCS_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-}}"
if [ -z "$PLUGIN_ROOT" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi
VALIDATE_SCRIPT="$PLUGIN_ROOT/skills/design-validate/scripts/validate.sh"

echo "==================================="
echo "Design Documentation Maintenance"
echo "==================================="
echo ""

# Run validation on all docs
echo "Running validation..."
if bash "$VALIDATE_SCRIPT" all; then
  echo "✅ All design docs are valid"
else
  echo "❌ Some design docs have validation errors"
  echo "Please fix validation errors before proceeding with maintenance"
  exit 1
fi

echo ""
echo "-----------------------------------"
echo "Checking for stale documentation..."
echo "-----------------------------------"
echo ""

STALE_COUNT=0
TODAY=$(date +%s)
THIRTY_DAYS_AGO=$((TODAY - 30*24*60*60))

# Find all markdown files (mapfile is bash >= 4; macOS ships /bin/bash 3.2,
# so build the array with a read loop instead)
DESIGN_FILES=()
while IFS= read -r _doc; do
  [ -n "$_doc" ] && DESIGN_FILES+=("$_doc")
done < <(find "$DESIGN_DIR" -type f -name "*.md" ! -name "design.config.json" | sort)

# Guard the loop on emptiness: under bash 3.2 with set -u, expanding an
# empty array with "${arr[@]}" is an unbound-variable error.
[ ${#DESIGN_FILES[@]} -gt 0 ] && for file in "${DESIGN_FILES[@]}"; do
  # Extract last-synced date from frontmatter (grep may legitimately not
  # match; || true keeps pipefail from killing the script)
  LAST_SYNCED=$(awk 'BEGIN{found=0} /^---$/{found++; next} found==1{print} found==2{exit}' "$file" | grep "^last-synced:" | awk '{print $2}' || true)

  if [[ -n "$LAST_SYNCED" ]]; then
    # Convert date to timestamp (BSD/macOS compatible)
    if date -j -f "%Y-%m-%d" "$LAST_SYNCED" +%s >/dev/null 2>&1; then
      LAST_SYNCED_TS=$(date -j -f "%Y-%m-%d" "$LAST_SYNCED" +%s)
    elif date -d "$LAST_SYNCED" +%s >/dev/null 2>&1; then
      LAST_SYNCED_TS=$(date -d "$LAST_SYNCED" +%s)
    else
      echo "⚠️  Invalid date format in $file: $LAST_SYNCED"
      continue
    fi

    if [[ "$LAST_SYNCED_TS" -lt "$THIRTY_DAYS_AGO" ]]; then
      DAYS_OLD=$(( (TODAY - LAST_SYNCED_TS) / 86400 ))
      echo "⚠️  Stale: $file"
      echo "   Last synced: $LAST_SYNCED ($DAYS_OLD days ago)"
      STALE_COUNT=$((STALE_COUNT + 1))
    fi
  else
    echo "⚠️  Missing last-synced date: $file"
    STALE_COUNT=$((STALE_COUNT + 1))
  fi
done

echo ""
echo "==================================="
echo "Maintenance Report Summary"
echo "==================================="
echo "Total design docs: ${#DESIGN_FILES[@]}"
echo "Stale docs (>30 days): $STALE_COUNT"
echo ""

if [[ "$STALE_COUNT" -gt 0 ]]; then
  echo "Recommended actions:"
  echo "1. Review stale documentation for accuracy"
  echo "2. Update design docs to match current codebase"
  echo "3. Use design-sync skill to sync with code"
  echo "4. Archive outdated documentation using design-archive skill"
  echo ""
  exit 0
else
  echo "✅ All design documentation is up to date!"
  exit 0
fi
