#!/usr/bin/env bash
set -euo pipefail

# Usage: validate-all-docs.sh
# Validates all design documentation files in .claude/design/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve user-project root via env vars set by the SessionStart hook /
# host, with git-toplevel and cwd as fallbacks. Never dirname-walk from
# $SCRIPT_DIR — that lands inside the plugin install.
PROJECT_DIR="${DESIGN_DOCS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [ -z "$PROJECT_DIR" ]; then
  PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
DESIGN_DIR="$PROJECT_DIR/.claude/design"

# Check if design directory exists
if [[ ! -d "$DESIGN_DIR" ]]; then
  echo "Error: Design directory not found: $DESIGN_DIR" >&2
  exit 1
fi

# Find all .md files in design directory (exclude design.config.json)
mapfile -t DESIGN_FILES < <(find "$DESIGN_DIR" -type f -name "*.md" | sort)

if [[ ${#DESIGN_FILES[@]} -eq 0 ]]; then
  echo "No design documentation files found in $DESIGN_DIR"
  exit 0
fi

echo "Validating ${#DESIGN_FILES[@]} design documentation files..."
echo ""

ERRORS=0
VALIDATED=0

for file in "${DESIGN_FILES[@]}"; do
  if "$SCRIPT_DIR/validate-design-doc.sh" "$file"; then
    VALIDATED=$((VALIDATED + 1))
  else
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "----------------------------------------"
echo "Validation Summary:"
echo "  Total files: ${#DESIGN_FILES[@]}"
echo "  Validated: $VALIDATED"
echo "  Errors: $ERRORS"
echo "----------------------------------------"

if [[ "$ERRORS" -gt 0 ]]; then
  exit 1
fi

exit 0
