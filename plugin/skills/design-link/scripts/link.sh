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

# Print in-content markdown links as `line<TAB>ref`.
#
# Every link target is emitted, not just `.md` ones. The design-doc style guide
# tells authors to point at real source paths, and restricting extraction to
# `.md` meant those links -- the ones the style guide asks for -- were never
# checked for existence at all.
#
# Skipped: absolute URLs (any `scheme:` prefix, incl. http/https/mailto),
# protocol-relative `//host`, and bare `#anchor` links (anchors are validated
# separately against heading slugs by check_anchor_refs).
extract_content_links() {
	local file="$1"
	grep -noE '\]\([^)]+\)' "$file" 2>/dev/null |
		sed -E 's/^([0-9]+):\]\(/\1\t/; s/\)$//' |
		awk -F'\t' '
			NF >= 2 && $2 != "" &&
			$2 !~ /^[a-zA-Z][a-zA-Z0-9+.-]*:/ &&
			$2 !~ /^\/\// &&
			$2 !~ /^#/ { print $1 "\t" $2 }
		' || true
}

fm_field() {
	local file="$1" key="$2"
	awk 'NR==1 && /^---[[:space:]]*$/ {f=1; next} f && /^---[[:space:]]*$/ {exit} f {print}' "$file" |
		grep -E "^${key}:" | head -1 | sed -E "s/^${key}:[[:space:]]*//; s/[[:space:]]*$//" || true
}

# --- heading anchors ---------------------------------------------------------

# Print each ATX heading's rendered text, one per line, skipping fenced code
# blocks so headings that appear inside ``` fences aren't mistaken for real
# headings.
extract_headings() {
	local file="$1"
	awk '
		/^```/ { fence = !fence; next }
		fence { next }
		/^#+[[:space:]]/ {
			line = $0
			sub(/^#+[[:space:]]+/, "", line)
			sub(/[[:space:]]+#+[[:space:]]*$/, "", line)
			sub(/[[:space:]]+$/, "", line)
			print line
		}
	' "$file"
}

# GitHub's heading-anchor algorithm: lowercase, drop everything that is not a
# letter, digit, space, or hyphen (this is what strips `@`, backticks, `.`,
# `/`, `(`, `)`, `:`, `,`, etc.), then turn each space into a hyphen — one
# per character, not one per run: "A × B" strips the glyph, leaves two
# spaces, and GitHub renders the anchor with two hyphens (a--b).
slugify_heading() {
	local text="$1" slug
	slug="$(printf '%s' "$text" | tr '[:upper:]' '[:lower:]')"
	slug="$(printf '%s' "$slug" | sed -E 's/[^a-z0-9 -]//g')"
	slug="$(printf '%s' "$slug" | sed -E 's/[[:space:]]/-/g')"
	printf '%s' "$slug"
}

# All heading slugs for a file, in document order, with GitHub's -1, -2, …
# duplicate-suffix behavior applied.
heading_slugs() {
	local file="$1" heading base slug count
	local seen=$'\x1e'
	while IFS= read -r heading; do
		[ -n "$heading" ] || continue
		base="$(slugify_heading "$heading")"
		slug="$base"
		count=1
		while [[ "$seen" == *$'\x1e'"$slug"$'\x1e'* ]]; do
			slug="${base}-${count}"
			count=$((count + 1))
		done
		seen+="${slug}"$'\x1e'
		printf '%s\n' "$slug"
	done < <(extract_headings "$file")
}

file_has_anchor() { # file anchor
	local file="$1" anchor="$2" slugs
	[ -f "$file" ] || return 1
	# Capture into a variable first and match via a here-string, not a live
	# pipe: `grep -q` exits as soon as it finds a match, and under
	# `pipefail` a SIGPIPE-killed upstream producer (heading_slugs) would
	# otherwise make the whole pipeline look like a failed lookup even
	# though the anchor matched.
	slugs="$(heading_slugs "$file")"
	grep -Fxq "$anchor" <<<"$slugs"
}

# Print raw `](...)` link targets that contain a '#', anchor intact (matches
# both same-file `(#anchor)` links and cross-file `(path.md#anchor)` links).
extract_anchor_refs() {
	local file="$1"
	grep -oE '\]\([^)]*#[^)]*\)' "$file" 2>/dev/null |
		sed -E 's/^\]\(//; s/\)$//' || true
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
# List a module's docs recursively (docs may live in subdirectories, e.g.
# packages/*.md), skipping _archive trees. Emits repo-root-relative paths.
module_docs() {
	local module="$1"
	[ -d "$DESIGN_ROOT/$module" ] || return 0
	find "$DESIGN_ROOT/$module" -name _archive -prune -o -type f -name '*.md' -print |
		sort |
		sed "s|^$DESIGN_ROOT/|${DESIGN_REL}/|"
}

add_nodes_for_module() {
	local module="$1" doc
	while IFS= read -r doc; do
		[ -n "$doc" ] || continue
		NODES+="${doc}"$'\n'
	done < <(module_docs "$module")
}

while IFS= read -r module; do
	[ -n "$module" ] || continue
	add_nodes_for_module "$module"
done <<<"$ALL_MODULES"

is_node() { printf '%s' "$NODES" | grep -Fxq "$1"; }

# --- collect edges and broken references -----------------------------------

# EDGES lines: from<TAB>to<TAB>type
EDGES=""
# BROKEN lines: from<TAB>intended-target<TAB>line ("0" when the ref came from
# frontmatter, which has no meaningful link line). Carrying the line makes two
# occurrences of the same broken link in one doc two distinct records -- they
# used to collapse under `sort -u`, so fixing "the" broken link could silently
# leave a second copy of it behind.
BROKEN=""
# BROKEN_ANCHORS lines: from<TAB>display-target(empty for same-file)<TAB>anchor
BROKEN_ANCHORS=""

collect_for_doc() {
	local src="$1" docdir r line
	docdir="$(dirname "$src")"

	add_ref() { # type line ref
		local type="$1" line="$2" ref="$3" resolved
		resolved="$(resolve_ref "$docdir" "$ref")"
		[ -n "$resolved" ] || return 0
		[[ "$resolved" == "$src" ]] && return 0 # self-link
		if is_node "$resolved"; then
			EDGES+="${src}	${resolved}	${type}"$'\n'
		elif [[ "$resolved" == "${DESIGN_REL}/"* && "$resolved" == *.md ]]; then
			# In-tree .md target that is not a known doc.
			BROKEN+="${src}	${resolved}	${line}"$'\n'
		elif [[ "$ref" != /* ]] && [ ! -e "$PROJECT_DIR/$resolved" ]; then
			# A relative link resolving OUTSIDE the design tree -- source files,
			# READMEs, configs. These were previously not checked at all, so
			# whether a dead link was caught depended only on where its path
			# happened to land, which no author can reason about.
			BROKEN+="${src}	${resolved}	${line}"$'\n'
		fi
	}

	while IFS= read -r r; do
		[ -n "$r" ] || continue
		add_ref related 0 "$r"
	done < <(extract_fm_list "$PROJECT_DIR/$src" related)

	while IFS= read -r r; do
		[ -n "$r" ] || continue
		add_ref dependency 0 "$r"
	done < <(extract_fm_list "$PROJECT_DIR/$src" dependencies)

	while IFS=$'\t' read -r line r; do
		[ -n "$r" ] || continue
		add_ref content-link "$line" "$r"
	done < <(extract_content_links "$PROJECT_DIR/$src")

	check_anchor_refs "$src" "$docdir"
}

# Validate every `#anchor` / `path.md#anchor` link in a doc against the real
# heading slugs of its target file (same doc for bare `#anchor` links).
#
# `to` is always populated (never left empty) even for same-file anchors —
# tab is an IFS-whitespace character, so a genuinely empty field between two
# tabs gets squeezed away by bash's field splitting on read, shifting every
# field after it. Same-file links are detected downstream by `to == from`.
check_anchor_refs() {
	local src="$1" docdir="$2" raw path anchor target target_file
	while IFS= read -r raw; do
		[ -n "$raw" ] || continue
		path="${raw%%#*}"
		anchor="${raw#*#}"
		[ -n "$anchor" ] || continue
		if [ -z "$path" ]; then
			target="$src"
		else
			target="$(resolve_ref "$docdir" "$path")"
			[ -n "$target" ] || continue
			is_node "$target" || continue # file-existence already reported via BROKEN
		fi
		target_file="$PROJECT_DIR/$target"
		if ! file_has_anchor "$target_file" "$anchor"; then
			BROKEN_ANCHORS+="${src}	${target}	${anchor}"$'\n'
		fi
	done < <(extract_anchor_refs "$PROJECT_DIR/$src")
}

# Iterate only the in-scope module(s) as edge sources.
while IFS= read -r module; do
	[ -n "$module" ] || continue
	if [ "$MODULE_ARG" != "all" ] && [ "$MODULE_ARG" != "$module" ]; then
		continue
	fi
	while IFS= read -r doc; do
		[ -n "$doc" ] || continue
		collect_for_doc "$doc"
	done < <(module_docs "$module")
done <<<"$ALL_MODULES"

# Dedupe.
EDGES="$(printf '%s' "$EDGES" | grep -v '^$' | sort -u || true)"
BROKEN="$(printf '%s' "$BROKEN" | grep -v '^$' | sort -u || true)"
BROKEN_ANCHORS="$(printf '%s' "$BROKEN_ANCHORS" | grep -v '^$' | sort -u || true)"

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
BROKEN_ANCHOR_COUNT="$(count_lines "$BROKEN_ANCHORS")"

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
	echo "- Broken anchors: ${BROKEN_ANCHOR_COUNT}"
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
		while IFS=$'\t' read -r from to line; do
			[ -n "$from" ] || continue
			if [ -n "$line" ] && [ "$line" != "0" ]; then
				echo "- ${from}:${line} → ${to} (target missing)"
			else
				echo "- ${from} → ${to} (target missing)"
			fi
		done <<<"$BROKEN"
	fi
	echo ""

	echo "## Broken Anchors"
	echo ""
	if [ -z "$BROKEN_ANCHORS" ]; then
		echo "_None._"
	else
		while IFS=$'\t' read -r from to anchor; do
			[ -n "$from" ] || continue
			if [ "$to" = "$from" ]; then
				echo "- ${from} → #${anchor} (anchor missing)"
			else
				echo "- ${from} → ${to}#${anchor} (anchor missing)"
			fi
		done <<<"$BROKEN_ANCHORS"
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
	# Every substitution below ends in `|| true`: under `set -o pipefail`,
	# `grep -v '^$'` exits 1 when its input is empty (a legitimately empty
	# list — e.g. no broken references), and without the guard that
	# non-zero status propagates through the pipe and `set -e` would abort
	# the whole script even though jq already produced a valid `[]`.
	local nodes_json edges_json broken_json broken_anchors_json orphans_json
	nodes_json="$(printf '%s' "$SCOPE_NODES" | grep -v '^$' | json_array || true)"
	orphans_json="$(printf '%s' "$ORPHANS" | grep -v '^$' | json_array || true)"
	edges_json="$(printf '%s' "$EDGES" | grep -v '^$' |
		awk -F'\t' 'NF>=3 {printf "{\"from\":\"%s\",\"to\":\"%s\",\"type\":\"%s\"}\n", $1, $2, $3}' |
		jq -s . || true)"
	broken_json="$(printf '%s' "$BROKEN" | grep -v '^$' |
		awk -F'\t' 'NF>=2 {printf "{\"from\":\"%s\",\"to\":\"%s\",\"line\":%s}\n", $1, $2, ($3 == "" ? 0 : $3)}' |
		jq -s . || true)"
	broken_anchors_json="$(printf '%s' "$BROKEN_ANCHORS" | grep -v '^$' |
		awk -F'\t' 'NF>=3 {printf "{\"from\":\"%s\",\"to\":\"%s\",\"anchor\":\"%s\"}\n", $1, $2, $3}' |
		jq -s . || true)"
	jq -n \
		--arg scope "$MODULE_ARG" \
		--argjson nodes "$nodes_json" \
		--argjson edges "$edges_json" \
		--argjson broken "$broken_json" \
		--argjson brokenAnchors "$broken_anchors_json" \
		--argjson orphans "$orphans_json" \
		'{scope: $scope, summary: {documents: ($nodes|length), references: ($edges|length), broken: ($broken|length), brokenAnchors: ($brokenAnchors|length), orphaned: ($orphans|length)}, nodes: $nodes, edges: $edges, broken: $broken, brokenAnchors: $brokenAnchors, orphaned: $orphans}'
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
