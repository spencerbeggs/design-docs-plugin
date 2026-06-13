#!/usr/bin/env bash
set -euo pipefail

# Design Documentation Cross-Reference Graph
#
# Builds the cross-reference graph between design docs by parsing each doc's
# frontmatter (related, dependencies) and in-content markdown links, then
# reports references, broken links, orphans, and one-way vs bidirectional
# pairs. This is the deterministic counterpart to design-validate: the skill
# runs it instead of free-forming a graph, so the output is always a graph and
# never wanders into unrelated work.
#
# Modules are discovered from .claude/design/design.config.json when present
# (and jq is installed); otherwise from the direct subdirectories of
# .claude/design/.
#
# Usage:
#   ./link.sh [module|all] [--format=text|json|mermaid]
#
# Exit: 0 always (informational). Broken-reference and orphan counts are
#       reported in the output for callers to act on.

# Resolve user-project root via env vars set by the SessionStart hook / host,
# with git-toplevel and cwd as fallbacks (matches validate.sh).
PROJECT_DIR="${DESIGN_DOCS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [ -z "$PROJECT_DIR" ]; then
	PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

DESIGN_ROOT="$PROJECT_DIR/.claude/design"
DESIGN_REL=".claude/design"
CONFIG_FILE="$DESIGN_ROOT/design.config.json"

MODULE_ARG="all"
FORMAT="text"
for arg in "$@"; do
	case "$arg" in
		--format=*) FORMAT="${arg#--format=}" ;;
		--*) ;;
		*) MODULE_ARG="$arg" ;;
	esac
done

case "$FORMAT" in
	text | json | mermaid) ;;
	*)
		echo "link: unknown format '$FORMAT' (expected text, json, or mermaid)" >&2
		exit 2
		;;
esac

# --- helpers ---------------------------------------------------------------

# Lexically normalize a path: drop '.' segments, collapse '..', no leading './'.
# Pure string work — the target need not exist (so missing links still resolve
# to a comparable path for broken-link reporting).
normalize_path() {
	local path="$1" part
	local -a out=()
	local IFS=/
	for part in $path; do
		case "$part" in
			'' | .) ;;
			..) [ ${#out[@]} -gt 0 ] && unset 'out[${#out[@]}-1]' ;;
			*) out+=("$part") ;;
		esac
	done
	printf '%s' "${out[*]}"
}

# Resolve a reference written inside a doc to a repo-root-relative path.
resolve_ref() {
	local docdir="$1" ref="$2"
	ref="${ref%%#*}"                                  # strip anchor
	ref="${ref#"${ref%%[![:space:]]*}"}"              # ltrim
	ref="${ref%"${ref##*[![:space:]]}"}"              # rtrim
	[ -z "$ref" ] && return 0
	if [[ "$ref" == /* ]]; then
		normalize_path "${ref#/}"
		return 0
	fi
	normalize_path "$docdir/$ref"
}

# Print each item of a frontmatter list key (related / dependencies). Handles
# the block form (`key:` then `  - item` lines), the inline empty form
# (`key: []`), and the inline list form (`key: [a, b]`).
extract_fm_list() {
	local file="$1" key="$2" fm line inline
	fm="$(awk 'NR==1 && /^---[[:space:]]*$/ {f=1; next} f && /^---[[:space:]]*$/ {exit} f {print}' "$file")"
	line="$(printf '%s\n' "$fm" | grep -E "^${key}:" | head -1 || true)"
	[ -z "$line" ] && return 0

	inline="${line#"${key}":}"
	inline="${inline#"${inline%%[![:space:]]*}"}" # ltrim

	if [[ "$inline" == "["*"]" ]]; then
		inline="${inline#[}"
		inline="${inline%]}"
		local IFS=, item
		for item in $inline; do
			item="$(printf '%s' "$item" | sed -E "s/^[[:space:]]*//; s/[[:space:]]*$//; s/^[\"']//; s/[\"']$//")"
			[ -n "$item" ] && printf '%s\n' "$item"
		done
		return 0
	fi

	if [ -n "$inline" ]; then
		printf '%s\n' "$inline" | sed -E "s/^[\"']//; s/[\"']$//"
		return 0
	fi

	# Block form.
	printf '%s\n' "$fm" | awk -v k="$key" '
		$0 ~ "^"k":[[:space:]]*$" {inblock=1; next}
		inblock {
			if ($0 ~ /^[[:space:]]+-[[:space:]]*/) {
				v=$0
				sub(/^[[:space:]]+-[[:space:]]*/, "", v)
				sub(/[[:space:]]+$/, "", v)
				if (v != "") print v
			} else if ($0 ~ /^[^[:space:]]/) {
				inblock=0
			}
		}
	' | sed -E "s/^[\"']//; s/[\"']$//"
}

# Print in-content markdown links to .md files (anchors stripped, http(s) skipped).
extract_content_links() {
	local file="$1"
	grep -oE '\]\([^)]+\.md[^)]*\)' "$file" 2>/dev/null |
		sed -E 's/^\]\(//; s/\)$//' |
		grep -v '://' || true
}

fm_field() {
	local file="$1" key="$2"
	awk 'NR==1 && /^---[[:space:]]*$/ {f=1; next} f && /^---[[:space:]]*$/ {exit} f {print}' "$file" |
		grep -E "^${key}:" | head -1 | sed -E "s/^${key}:[[:space:]]*//; s/[[:space:]]*$//" || true
}

# --- discover modules ------------------------------------------------------

discover_modules() {
	if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
		local mods
		mods="$(jq -r '.modules // {} | keys[]' "$CONFIG_FILE" 2>/dev/null || true)"
		if [ -n "$mods" ]; then
			printf '%s\n' "$mods"
			return 0
		fi
	fi
	[ -d "$DESIGN_ROOT" ] || return 0
	find "$DESIGN_ROOT" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
}

# --- build node set (all modules, for cross-module edge validation) --------

ALL_MODULES="$(discover_modules)"

NODES=""
add_nodes_for_module() {
	local module="$1" file base
	for file in "$DESIGN_ROOT/$module"/*.md; do
		[ -f "$file" ] || continue
		base="$(basename "$file")"
		[ "$base" = "design.config.json" ] && continue
		NODES+="${DESIGN_REL}/${module}/${base}"$'\n'
	done
}

while IFS= read -r module; do
	[ -n "$module" ] || continue
	add_nodes_for_module "$module"
done <<<"$ALL_MODULES"

is_node() { printf '%s' "$NODES" | grep -Fxq "$1"; }

# --- collect edges and broken references -----------------------------------

# EDGES lines: from<TAB>to<TAB>type
EDGES=""
# BROKEN lines: from<TAB>intended-target
BROKEN=""

collect_for_doc() {
	local src="$1" docdir ref resolved
	docdir="$(dirname "$src")"

	add_refs() {
		local type="$1"
		local r
		while IFS= read -r r; do
			[ -n "$r" ] || continue
			resolved="$(resolve_ref "$docdir" "$r")"
			[ -n "$resolved" ] || continue
			[[ "$resolved" == "$src" ]] && continue # self-link
			if is_node "$resolved"; then
				EDGES+="${src}	${resolved}	${type}"$'\n'
			elif [[ "$resolved" == "${DESIGN_REL}/"* && "$resolved" == *.md ]]; then
				BROKEN+="${src}	${resolved}"$'\n'
			fi
		done
	}

	add_refs related < <(extract_fm_list "$PROJECT_DIR/$src" related)
	add_refs dependency < <(extract_fm_list "$PROJECT_DIR/$src" dependencies)
	add_refs content-link < <(extract_content_links "$PROJECT_DIR/$src")
}

# Iterate only the in-scope module(s) as edge sources.
while IFS= read -r module; do
	[ -n "$module" ] || continue
	if [ "$MODULE_ARG" != "all" ] && [ "$MODULE_ARG" != "$module" ]; then
		continue
	fi
	for file in "$DESIGN_ROOT/$module"/*.md; do
		[ -f "$file" ] || continue
		base="$(basename "$file")"
		[ "$base" = "design.config.json" ] && continue
		collect_for_doc "${DESIGN_REL}/${module}/${base}"
	done
done <<<"$ALL_MODULES"

# Dedupe.
EDGES="$(printf '%s' "$EDGES" | grep -v '^$' | sort -u || true)"
BROKEN="$(printf '%s' "$BROKEN" | grep -v '^$' | sort -u || true)"

edge_exists() { # from to
	printf '%s\n' "$EDGES" | grep -qE "^$1	$2	" 2>/dev/null
}

# Nodes in scope (for the document list / orphan check).
SCOPE_NODES=""
while IFS= read -r module; do
	[ -n "$module" ] || continue
	if [ "$MODULE_ARG" != "all" ] && [ "$MODULE_ARG" != "$module" ]; then
		continue
	fi
	while IFS= read -r n; do
		[[ "$n" == "${DESIGN_REL}/${module}/"* ]] && SCOPE_NODES+="${n}"$'\n'
	done <<<"$NODES"
done <<<"$ALL_MODULES"
SCOPE_NODES="$(printf '%s' "$SCOPE_NODES" | grep -v '^$' | sort -u || true)"

node_has_edge() { # a node is connected if it is the source or target of any edge
	printf '%s\n' "$EDGES" | grep -qE "(^$1	)|(	$1	)" 2>/dev/null
}

# --- counts ----------------------------------------------------------------

count_lines() {
	if [ -z "$1" ]; then
		echo 0
	else
		printf '%s\n' "$1" | grep -c '^'
	fi
}

DOC_COUNT="$(count_lines "$SCOPE_NODES")"
EDGE_COUNT="$(count_lines "$EDGES")"
BROKEN_COUNT="$(count_lines "$BROKEN")"

ORPHANS=""
while IFS= read -r n; do
	[ -n "$n" ] || continue
	node_has_edge "$n" || ORPHANS+="${n}"$'\n'
done <<<"$SCOPE_NODES"
ORPHANS="$(printf '%s' "$ORPHANS" | grep -v '^$' || true)"
ORPHAN_COUNT="$(count_lines "$ORPHANS")"

# --- output ----------------------------------------------------------------

emit_text() {
	echo "# Design Documentation Cross-Reference Graph"
	echo ""
	echo "**Date:** $(date +%Y-%m-%d)"
	echo "**Scope:** ${MODULE_ARG}"
	echo ""
	echo "## Summary"
	echo ""
	echo "- Documents: ${DOC_COUNT}"
	echo "- References: ${EDGE_COUNT}"
	echo "- Broken references: ${BROKEN_COUNT}"
	echo "- Orphaned documents: ${ORPHAN_COUNT}"
	echo ""

	echo "## Documents"
	echo ""
	if [ -z "$SCOPE_NODES" ]; then
		echo "_No design documents found._"
	else
		while IFS= read -r n; do
			[ -n "$n" ] || continue
			local status completeness
			status="$(fm_field "$PROJECT_DIR/$n" status)"
			completeness="$(fm_field "$PROJECT_DIR/$n" completeness)"
			echo "- ${n} (${status:-?}, ${completeness:-?}%)"
		done <<<"$SCOPE_NODES"
	fi
	echo ""

	echo "## References"
	echo ""
	if [ -z "$EDGES" ]; then
		echo "_No references found._"
	else
		local shown=""
		while IFS=$'\t' read -r from to type; do
			[ -n "$from" ] || continue
			if [ "$type" = "related" ] && edge_exists "$to" "$from"; then
				# Collapse mutual related links into a single bidirectional line.
				local key
				if [[ "$from" < "$to" ]]; then key="${from}|${to}"; else key="${to}|${from}"; fi
				printf '%s\n' "$shown" | grep -Fxq "$key" && continue
				shown+="${key}"$'\n'
				echo "- ${from} ↔ ${to} (related)"
			else
				echo "- ${from} → ${to} (${type})"
			fi
		done <<<"$EDGES"
	fi
	echo ""

	echo "## Broken References"
	echo ""
	if [ -z "$BROKEN" ]; then
		echo "_None._"
	else
		while IFS=$'\t' read -r from to; do
			[ -n "$from" ] || continue
			echo "- ${from} → ${to} (target missing)"
		done <<<"$BROKEN"
	fi
	echo ""

	echo "## Orphaned Documents"
	echo ""
	if [ -z "$ORPHANS" ]; then
		echo "_None._"
	else
		while IFS= read -r n; do
			[ -n "$n" ] || continue
			echo "- ${n}"
		done <<<"$ORPHANS"
	fi
}

json_array() { # turns newline list on stdin into a JSON string array
	jq -R . | jq -s .
}

emit_json() {
	local nodes_json edges_json broken_json orphans_json
	nodes_json="$(printf '%s' "$SCOPE_NODES" | grep -v '^$' | json_array)"
	orphans_json="$(printf '%s' "$ORPHANS" | grep -v '^$' | json_array)"
	edges_json="$(printf '%s' "$EDGES" | grep -v '^$' |
		awk -F'\t' 'NF>=3 {printf "{\"from\":\"%s\",\"to\":\"%s\",\"type\":\"%s\"}\n", $1, $2, $3}' |
		jq -s .)"
	broken_json="$(printf '%s' "$BROKEN" | grep -v '^$' |
		awk -F'\t' 'NF>=2 {printf "{\"from\":\"%s\",\"to\":\"%s\"}\n", $1, $2}' |
		jq -s .)"
	jq -n \
		--arg scope "$MODULE_ARG" \
		--argjson nodes "$nodes_json" \
		--argjson edges "$edges_json" \
		--argjson broken "$broken_json" \
		--argjson orphans "$orphans_json" \
		'{scope: $scope, summary: {documents: ($nodes|length), references: ($edges|length), broken: ($broken|length), orphaned: ($orphans|length)}, nodes: $nodes, edges: $edges, broken: $broken, orphaned: $orphans}'
}

emit_mermaid() {
	echo '```mermaid'
	echo 'graph TD'
	id_for() { # deterministic node id
		printf 'N%s' "$(printf '%s' "$1" | cksum | cut -d' ' -f1)"
	}
	while IFS= read -r n; do
		[ -n "$n" ] || continue
		echo "  $(id_for "$n")[\"${n##*/}\"]"
	done <<<"$SCOPE_NODES"
	while IFS=$'\t' read -r from to type; do
		[ -n "$from" ] || continue
		if [ "$type" = "related" ]; then
			echo "  $(id_for "$from") --- $(id_for "$to")"
		else
			echo "  $(id_for "$from") --> $(id_for "$to")"
		fi
	done <<<"$EDGES"
	echo '```'
}

case "$FORMAT" in
	text) emit_text ;;
	json) emit_json ;;
	mermaid) emit_mermaid ;;
esac

exit 0
