#!/usr/bin/env bash
set -euo pipefail

# Design Documentation Validation Script
# Validates frontmatter, structure, and cross-references
#
# Modules are discovered from .claude/design/design.config.json when present
# (categories are read from modules.<name>.categories). If the config is
# missing or jq is not installed, modules are discovered by listing direct
# subdirectories of .claude/design/ and category validation is skipped.
#
# Recommended-section warnings ("Missing recommended section '<name>'") are
# driven by quality.designDocs.minSections in design.config.json when that
# file exists -- an omitted or empty minSections is treated as "this project
# doesn't require recommended sections," not as a cue to use the built-in
# default list. The built-in default (Overview / Current State / Rationale)
# only applies when there is no design.config.json at all. Heading matches
# are case-insensitive, so sentence-case headings (the project's own style
# convention) are honored the same as title-case ones.
#
# Usage:
#   ./validate.sh [module|all]
#
# Examples:
#   ./validate.sh all
#   ./validate.sh my-module-name

# Resolve user-project root via env vars set by the SessionStart hook /
# host, with git-toplevel and cwd as fallbacks.
PROJECT_DIR="${DESIGN_DOCS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [ -z "$PROJECT_DIR" ]; then
  PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

ERRORS=0
WARNINGS=0
FILES_CHECKED=0

# Valid status values
VALID_STATUSES=("stub" "draft" "current" "needs-review" "archived")

echo "# Design Documentation Validation Report"
echo ""
echo "**Date:** $(date +%Y-%m-%d)"
echo "**Modules:** ${1:-all}"
echo ""

# Scans a design doc's markdown body (everything after the frontmatter) for
# prose paragraphs hard-wrapped across multiple source lines. The project's
# style mandates one source line per paragraph -- the renderer soft-wraps,
# and MD013 (line length) is disabled intentionally -- so a paragraph split
# across consecutive source lines is a style violation, not a formatting nicety.
#
# Heuristic: walk the body tracking whether we're inside a fenced code block
# (```/~~~ toggle) or on a table row (line starts with |, after trimming
# leading whitespace). Neither ever warns. Otherwise, when two consecutive
# non-blank lines appear with no blank line between them, the second line
# warns UNLESS it itself starts a new block (heading `#`, list marker
# `-`/`*`/`+`/`N.`, blockquote `>`, or table `|`) -- that covers list items
# and headings that legitimately follow one another without a blank line.
# This is intentionally block-marker-based rather than list-aware: a wrapped
# list-item continuation (an indented line following a list item that is not
# itself a new list item, code fence, table row, or blockquote) trips the
# exact same "non-blank line follows non-blank line, and isn't a block
# start" signal as a wrapped plain paragraph, so list contexts are covered
# for free without a separate code path.
#
# Emits at most one warning per offending paragraph (suppressed until the
# next blank line or block-start line). Line-level detail is capped at
# HARD_WRAP_MAX_WARNINGS per file to avoid flooding the report, but the
# TRUE total is still counted: when the cap is hit, a trailing summary
# warning reports the full count so a document that is hard-wrapped
# end-to-end doesn't look identical to one with a handful of bad lines.
# Sets the global HARD_WRAP_COUNT to the true (uncapped) total number of
# warnings so the caller can fold it into WARNINGS / file_warnings.
HARD_WRAP_MAX_WARNINGS=5

check_hard_wrapped_prose() {
	local file="$1"
	local body_start="$2"
	local in_code=0
	local prev_nonblank=0
	local warned_this_paragraph=0
	local lineno=$((body_start - 1))
	local line trimmed is_block_start

	HARD_WRAP_COUNT=0

	while IFS= read -r line; do
		lineno=$((lineno + 1))

		trimmed="${line#"${line%%[![:space:]]*}"}"

		if [[ "$trimmed" =~ ^(\`\`\`|~~~) ]]; then
			in_code=$((1 - in_code))
			prev_nonblank=0
			warned_this_paragraph=0
			continue
		fi
		[ "$in_code" -eq 1 ] && continue

		if [ -z "${line//[[:space:]]/}" ]; then
			prev_nonblank=0
			warned_this_paragraph=0
			continue
		fi

		is_block_start=0
		if [[ "$trimmed" =~ ^# ]] ||
			[[ "$trimmed" =~ ^[-*+][[:space:]] ]] ||
			[[ "$trimmed" =~ ^[0-9]+\.[[:space:]] ]] ||
			[[ "$trimmed" =~ ^\> ]] ||
			[[ "$trimmed" =~ ^\| ]]; then
			is_block_start=1
		fi

		if [ "$prev_nonblank" -ne 0 ] && [ "$is_block_start" -eq 0 ] && [ "$warned_this_paragraph" -eq 0 ]; then
			if [ "$HARD_WRAP_COUNT" -lt "$HARD_WRAP_MAX_WARNINGS" ]; then
				echo "  - ⚠️  WARNING: Hard-wrapped prose detected (line ${lineno}): paragraphs must occupy a single source line"
			fi
			HARD_WRAP_COUNT=$((HARD_WRAP_COUNT + 1))
			warned_this_paragraph=1
		fi

		[ "$is_block_start" -eq 1 ] && warned_this_paragraph=0
		prev_nonblank=$lineno
	done < <(tail -n +"$body_start" "$file")

	if [ "$HARD_WRAP_COUNT" -gt "$HARD_WRAP_MAX_WARNINGS" ]; then
		echo "  - ⚠️  WARNING: ${HARD_WRAP_COUNT} hard-wrapped lines total, first ${HARD_WRAP_MAX_WARNINGS} shown"
	fi
}

# Function to validate a single file
validate_file() {
	local file="$1"
	local module="$2"
	local allowed_categories="$3"

	FILES_CHECKED=$((FILES_CHECKED + 1))
	local file_errors=0
	local file_warnings=0

	# Extract frontmatter (between first two --- markers).
	# `|| true`: under `set -e` + `set -o pipefail`, grep finding no `---` at all
	# exits 1 and would abort the entire run -- so a doc with no frontmatter used
	# to kill validation mid-report instead of being reported as the error it is.
	local fm_start
	local fm_end
	fm_start=$(grep -n "^---$" "$file" | head -1 | cut -d: -f1 || true)
	fm_end=$(grep -n "^---$" "$file" | head -2 | tail -1 | cut -d: -f1 || true)

	if [ -z "$fm_start" ] || [ -z "$fm_end" ] || [ "$fm_start" -ge "$fm_end" ]; then
		echo "  - ❌ ERROR: Missing or invalid frontmatter structure"
		ERRORS=$((ERRORS + 1))
		file_errors=$((file_errors + 1))
		return
	fi

	local fm
	fm=$(sed -n "${fm_start},${fm_end}p" "$file")

	# Check required fields. `dependencies` is deliberately absent: it is an
	# optional field (see frontmatter-rules.md). Requiring it made every doc
	# not scaffolded from a template permanently red for a reason no author
	# could act on, which taught readers to skip the whole report.
	local required_fields=("status" "module" "category" "created" "updated" "last-synced" "completeness" "related")
	for field in "${required_fields[@]}"; do
		if ! echo "$fm" | grep -q "^${field}:"; then
			echo "  - ❌ ERROR: Missing required field '${field}'"
			ERRORS=$((ERRORS + 1))
			file_errors=$((file_errors + 1))
		fi
	done

	# Extract field values
	# shellcheck disable=SC2155
	local status=$(echo "$fm" | grep "^status:" | sed 's/status: *//' | tr -d '\r')
	# shellcheck disable=SC2155
	local module_val=$(echo "$fm" | grep "^module:" | sed 's/module: *//' | tr -d '\r')
	# shellcheck disable=SC2155
	local category=$(echo "$fm" | grep "^category:" | sed 's/category: *//' | tr -d '\r')
	# shellcheck disable=SC2155
	local created=$(echo "$fm" | grep "^created:" | sed 's/created: *//' | tr -d '\r')
	# shellcheck disable=SC2155
	local updated=$(echo "$fm" | grep "^updated:" | sed 's/updated: *//' | tr -d '\r')
	# shellcheck disable=SC2155
	local last_synced=$(echo "$fm" | grep "^last-synced:" | sed 's/last-synced: *//' | tr -d '\r')
	# shellcheck disable=SC2155
	local completeness=$(echo "$fm" | grep "^completeness:" | sed 's/completeness: *//' | tr -d '\r')

	# Validate status
	if [ -n "$status" ]; then
		local valid=0
		for valid_status in "${VALID_STATUSES[@]}"; do
			if [ "$status" = "$valid_status" ]; then
				valid=1
				break
			fi
		done
		if [ $valid -eq 0 ]; then
			echo "  - ❌ ERROR: Invalid status '${status}' (expected: stub, draft, current, needs-review, or archived)"
			ERRORS=$((ERRORS + 1))
			file_errors=$((file_errors + 1))
		fi
	fi

	# Validate module matches
	if [ -n "$module_val" ] && [ "$module_val" != "$module" ]; then
		echo "  - ⚠️  WARNING: Module field '${module_val}' doesn't match directory '${module}'"
		WARNINGS=$((WARNINGS + 1))
		file_warnings=$((file_warnings + 1))
	fi

	# Validate category is allowed
	if [ -n "$category" ] && [ -n "$allowed_categories" ]; then
		if ! echo "$allowed_categories" | grep -q "\"$category\""; then
			echo "  - ❌ ERROR: Category '${category}' not in allowed list: ${allowed_categories}"
			ERRORS=$((ERRORS + 1))
			file_errors=$((file_errors + 1))
		fi
	fi

	# Validate date formats (YYYY-MM-DD)
	local date_regex='^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
	if [ -n "$created" ] && ! [[ "$created" =~ $date_regex ]]; then
		echo "  - ❌ ERROR: Invalid date format for 'created': ${created} (expected YYYY-MM-DD)"
		ERRORS=$((ERRORS + 1))
		file_errors=$((file_errors + 1))
	fi
	if [ -n "$updated" ] && ! [[ "$updated" =~ $date_regex ]]; then
		echo "  - ❌ ERROR: Invalid date format for 'updated': ${updated} (expected YYYY-MM-DD)"
		ERRORS=$((ERRORS + 1))
		file_errors=$((file_errors + 1))
	fi
	if [ -n "$last_synced" ] && [ "$last_synced" != "never" ] && ! [[ "$last_synced" =~ $date_regex ]]; then
		echo "  - ❌ ERROR: Invalid date format for 'last-synced': ${last_synced} (expected YYYY-MM-DD or 'never')"
		ERRORS=$((ERRORS + 1))
		file_errors=$((file_errors + 1))
	fi

	# Validate completeness is 0-100
	if [ -n "$completeness" ]; then
		if ! [[ "$completeness" =~ ^[0-9]+$ ]] || [ "$completeness" -lt 0 ] || [ "$completeness" -gt 100 ]; then
			echo "  - ❌ ERROR: Invalid completeness: ${completeness} (expected 0-100)"
			ERRORS=$((ERRORS + 1))
			file_errors=$((file_errors + 1))
		fi
	fi

	# Validate status-completeness match
	if [ -n "$status" ] && [ -n "$completeness" ]; then
		case "$status" in
			"stub")
				if [ "$completeness" -gt 20 ]; then
					echo "  - ⚠️  WARNING: Status 'stub' but completeness ${completeness} > 20"
					WARNINGS=$((WARNINGS + 1))
					file_warnings=$((file_warnings + 1))
				fi
				;;
			"draft")
				# A pre-implementation design doc can legitimately be draft with
				# high completeness (design fully fleshed out, code not yet
				# written), so the upper bound is 90, not 60 -- otherwise a
				# fully-designed draft gets a false "promote to current" nudge.
				if [ "$completeness" -le 20 ] || [ "$completeness" -gt 90 ]; then
					echo "  - ⚠️  WARNING: Status 'draft' but completeness ${completeness} outside 21-90 range"
					WARNINGS=$((WARNINGS + 1))
					file_warnings=$((file_warnings + 1))
				fi
				;;
			"current"|"needs-review")
				if [ "$completeness" -lt 61 ]; then
					echo "  - ⚠️  WARNING: Status '${status}' but completeness ${completeness} < 61"
					WARNINGS=$((WARNINGS + 1))
					file_warnings=$((file_warnings + 1))
				fi
				;;
		esac
	fi

	# Check for recommended sections. The list comes from
	# quality.designDocs.minSections in design.config.json so the warning honors
	# the project's configured standard instead of a hardcoded default.
	if [ ${#MIN_SECTIONS[@]} -gt 0 ]; then
		for section in "${MIN_SECTIONS[@]}"; do
			if ! grep -qi "^## ${section}" "$file"; then
				echo "  - ⚠️  WARNING: Missing recommended section '${section}'"
				WARNINGS=$((WARNINGS + 1))
				file_warnings=$((file_warnings + 1))
			fi
		done
	fi

	# Check the markdown body (after frontmatter) for hard-wrapped prose. The
	# project's style mandates one source line per paragraph; MD013 is
	# disabled intentionally because the renderer soft-wraps.
	check_hard_wrapped_prose "$file" "$((fm_end + 1))"
	if [ "$HARD_WRAP_COUNT" -gt 0 ]; then
		WARNINGS=$((WARNINGS + HARD_WRAP_COUNT))
		file_warnings=$((file_warnings + HARD_WRAP_COUNT))
	fi

	if [ $file_errors -eq 0 ] && [ $file_warnings -eq 0 ]; then
		echo "  ✅ PASS"
	elif [ $file_errors -eq 0 ]; then
		echo "  ⚠️  PASS with warnings"
	fi
}

# Discover modules: prefer the config file (gives us categories), fall back
# to directory listing.
CONFIG_FILE="$PROJECT_DIR/.claude/design/design.config.json"
DESIGN_ROOT="$PROJECT_DIR/.claude/design"

# Recommended sections come from quality.designDocs.minSections when a
# design.config.json is present -- including the case where the config
# exists but the project simply hasn't declared minSections (or declares an
# empty array), which is treated as an explicit "no recommended sections
# required" signal rather than a cue to fall back to a hardcoded list. The
# historical default list only applies when there is no design.config.json
# at all, so a project without one still gets sensible out-of-the-box
# warnings. Heading matches in validate_file are case-insensitive so this
# list can be written in either title case or the project's sentence-case
# heading convention.
MIN_SECTIONS=()
if [ ! -f "$CONFIG_FILE" ]; then
	MIN_SECTIONS=("Overview" "Current State" "Rationale")
elif command -v jq &>/dev/null &&
	jq -e '.quality.designDocs.minSections | type == "array"' "$CONFIG_FILE" >/dev/null 2>&1; then
	while IFS= read -r section; do
		[ -n "$section" ] && MIN_SECTIONS+=("$section")
	done < <(jq -r '.quality.designDocs.minSections[]' "$CONFIG_FILE" 2>/dev/null)
fi

discover_modules_from_config() {
	[ -f "$CONFIG_FILE" ] || return 1
	command -v jq &>/dev/null || return 1
	jq -r '.modules // {} | keys[]' "$CONFIG_FILE" 2>/dev/null
}

categories_for_module() {
	local mod="$1"
	if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
		jq -c --arg m "$mod" '.modules[$m].categories // []' "$CONFIG_FILE" 2>/dev/null
	else
		echo ""
	fi
}

discover_modules_from_fs() {
	[ -d "$DESIGN_ROOT" ] || return 0
	find "$DESIGN_ROOT" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
}

MODULE_ARG="${1:-all}"

MODULES=""
if MODULES=$(discover_modules_from_config) && [ -n "$MODULES" ]; then
	:
else
	MODULES=$(discover_modules_from_fs)
fi

if [ -z "$MODULES" ]; then
	echo "_No design doc modules found under ${DESIGN_ROOT}/_"
	echo ""
fi

while IFS= read -r module; do
	[ -n "$module" ] || continue
	if [ "$MODULE_ARG" != "all" ] && [ "$MODULE_ARG" != "$module" ]; then
		continue
	fi
	echo "## $module"
	echo ""
	CATEGORIES=$(categories_for_module "$module")
	# Recurse: modules nest their docs (e.g. <module>/packages/*.md), and a flat
	# glob silently skipped every one of them -- a clean run was indistinguishable
	# from a run that never looked. `_archive` is pruned, matching design-link.
	while IFS= read -r file; do
		[ -n "$file" ] || continue
		[ -f "$file" ] || continue
		# Label by path relative to the module dir so nested docs are
		# distinguishable from same-named top-level ones.
		echo "- **${file#"$DESIGN_ROOT/$module/"}**"
		validate_file "$file" "$module" "$CATEGORIES"
	done < <(find "$DESIGN_ROOT/$module" -name _archive -prune -o -type f -name '*.md' -print | sort)
	echo ""
done <<< "$MODULES"

# Summary
echo "---"
echo ""
echo "## Summary"
echo ""
echo "**Files validated:** ${FILES_CHECKED}"
echo "**Errors:** ${ERRORS}"
echo "**Warnings:** ${WARNINGS}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
	echo "✅ **PASS** - All files valid!"
	exit 0
elif [ $ERRORS -eq 0 ]; then
	echo "⚠️  **PASS WITH WARNINGS** - No errors but ${WARNINGS} warning(s)"
	exit 0
else
	echo "❌ **FAIL** - ${ERRORS} error(s) found"
	exit 1
fi
