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
# The destination is *parsed*, not just regex-sliced, because a checker that
# invents broken links is worse than one that misses them. CommonMark allows
# forms a naive `\]\([^)]+\)` match mangles into paths that exist nowhere:
#
#   [x](./x.md "title")          -> title must be stripped, else the ref is `./x.md "title"`
#   [x](<./weird name.md>)       -> angle-bracket form must be unwrapped
#   [x](foo(bar).md)             -> balanced parens belong to the destination
#
# Each of those would otherwise be reported as a missing file.
#
# Skipped: absolute URLs (any `scheme:` prefix, incl. http/https/mailto),
# protocol-relative `//host`, and bare `#anchor` links (anchors are extracted
# separately by extract_anchor_refs and validated against heading slugs in
# classify_refs).
extract_content_links() {
	local file="$1"
	awk '
		{
			line = $0
			pos = 1
			while ((idx = index(substr(line, pos), "](")) > 0) {
				start = pos + idx + 1        # first char of the destination
				i = start
				depth = 1
				dest = ""
				# Walk to the destination-closing paren, tracking nesting so
				# `foo(bar).md` survives intact.
				while (i <= length(line)) {
					c = substr(line, i, 1)
					if (c == "(") depth++
					else if (c == ")") { depth--; if (depth == 0) break }
					dest = dest c
					i++
				}
				pos = i + 1
				if (depth != 0) continue     # unterminated link — ignore

				# Strip a trailing title, double- or single-quoted.
				# \047 is the POSIX octal escape for a single quote; \x27 is an
				# awk extension that stricter implementations (mawk, the default
				# awk on Debian/Ubuntu) need not honor -- and a missed match here
				# leaves the title glued to the path, which reports as a broken
				# link. The quote cannot be written literally: the whole awk
				# program is inside a single-quoted shell string.
				sub(/[[:space:]]+"[^"]*"[[:space:]]*$/, "", dest)
				sub(/[[:space:]]+\047[^\047]*\047[[:space:]]*$/, "", dest)
				# Trim surrounding whitespace.
				gsub(/^[[:space:]]+|[[:space:]]+$/, "", dest)
				# Unwrap the <...> destination form.
				if (dest ~ /^<.*>$/) dest = substr(dest, 2, length(dest) - 2)

				if (dest == "") continue
				if (dest ~ /^[a-zA-Z][a-zA-Z0-9+.-]*:/) continue   # scheme: (http, mailto, …)
				if (dest ~ /^\/\//) continue                       # protocol-relative
				if (dest ~ /^#/) continue                          # bare anchor
				print NR "\t" dest
			}
		}
	' "$file" 2>/dev/null || true
}

fm_field() {
	local file="$1" key="$2"
	awk 'NR==1 && /^---[[:space:]]*$/ {f=1; next} f && /^---[[:space:]]*$/ {exit} f {print}' "$file" |
		grep -E "^${key}:" | head -1 | sed -E "s/^${key}:[[:space:]]*//; s/[[:space:]]*$//" || true
}

# --- heading anchors ---------------------------------------------------------
#
# Heading extraction, GitHub slugification, and the anchor membership test
# itself used to be separate bash functions (extract_headings, slugify_heading,
# heading_slugs, file_has_anchor) called once per anchor *reference*. On a
# corpus where 279 anchor links concentrate on a handful of popular targets,
# that re-derived the same file's full heading list dozens of times. The logic
# now lives inside classify_refs' compute_slugs()/has_anchor(), which memoize
# per target file (awk has real associative arrays, so the memo needs no
# bash-3.2 workaround) — see the awk program below for the ported algorithm.

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

# --- collect raw references (no resolution/classification here) ------------
#
# Per-reference work used to fork a subshell for resolve_ref and a grep for
# is_node membership -- 418 content links + 279 anchor links meant 1,600+
# process spawns on a 22-doc corpus (#65). Collection now only *extracts* raw
# reference records (still O(docs) subprocess work, same as before); all
# resolution, node-membership, and anchor-slug classification happens in one
# awk invocation (classify_refs, below) that runs once over every record.
#
# REFS lines: src<TAB>docdir<TAB>type<TAB>line<TAB>ref
#   type is one of: related, dependency, content-link, anchor
#   line is "0" for frontmatter/anchor records (no meaningful link line)
#   ref carries the anchor intact for `anchor` records (path#anchor / #anchor)
REFS=""

collect_for_doc() {
	local src="$1" docdir r line
	docdir="$(dirname "$src")"

	while IFS= read -r r; do
		[ -n "$r" ] || continue
		REFS+="${src}	${docdir}	related	0	${r}"$'\n'
	done < <(extract_fm_list "$PROJECT_DIR/$src" related)

	while IFS= read -r r; do
		[ -n "$r" ] || continue
		REFS+="${src}	${docdir}	dependency	0	${r}"$'\n'
	done < <(extract_fm_list "$PROJECT_DIR/$src" dependencies)

	while IFS=$'\t' read -r line r; do
		[ -n "$r" ] || continue
		REFS+="${src}	${docdir}	content-link	${line}	${r}"$'\n'
	done < <(extract_content_links "$PROJECT_DIR/$src")

	while IFS= read -r r; do
		[ -n "$r" ] || continue
		REFS+="${src}	${docdir}	anchor	0	${r}"$'\n'
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

# --- classify every reference in one awk pass -------------------------------
#
# Ports resolve_ref/normalize_path (path resolution), node-set membership,
# and the heading-anchor pipeline (extract_headings/slugify_heading/
# heading_slugs/file_has_anchor) into a single awk program, because awk's
# associative arrays give O(1) node-membership and per-file slug memoization
# natively -- the bash-3.2 constraint that forced the old grep-per-reference
# and re-parse-per-reference patterns doesn't apply inside the awk program.
#
# Emits tagged TSV lines on stdout:
#   EDGE<TAB>from<TAB>to<TAB>type
#   BROKEN<TAB>from<TAB>target<TAB>line
#   ANCHOR<TAB>from<TAB>target<TAB>anchor
#
# The node set is passed as a FILE argument, not a `-v` string, and read via
# the classic `FNR==NR` two-file idiom: macOS's /usr/bin/awk (the "one true
# awk") rejects a `-v name=value` whose value contains a literal newline
# ("awk: newline in string ..."), and NODES is a newline-delimited list.
classify_refs() {
	local nodes_file
	nodes_file="$(mktemp "${TMPDIR:-/tmp}/design-link-nodes.XXXXXX")"
	printf '%s\n' "$NODES" >"$nodes_file"
	awk -v project_dir="$PROJECT_DIR" -v design_rel="$DESIGN_REL" '
		BEGIN { FS = "\t"; OFS = "\t" }

		# First file argument (nodes_file): one node path per line.
		FNR == NR {
			if ($0 != "") node[$0] = 1
			next
		}

		# Lexically normalize a path: drop "." segments, collapse "..", no
		# leading "./". Pure string work -- the target need not exist (so
		# missing links still resolve to a comparable path for broken-link
		# reporting). Mirrors the old bash normalize_path().
		function normalize_path(path,    parts, i, n, out, depth, result) {
			n = split(path, parts, "/")
			depth = 0
			for (i = 1; i <= n; i++) {
				if (parts[i] == "" || parts[i] == ".") continue
				if (parts[i] == "..") {
					if (depth > 0) depth--
					continue
				}
				depth++
				out[depth] = parts[i]
			}
			result = ""
			for (i = 1; i <= depth; i++) result = (result == "") ? out[i] : result "/" out[i]
			return result
		}

		# Resolve a reference written inside a doc to a repo-root-relative
		# path. Mirrors the old bash resolve_ref().
		function resolve_ref(docdir, ref,    hashpos) {
			hashpos = index(ref, "#")
			if (hashpos > 0) ref = substr(ref, 1, hashpos - 1)
			gsub(/^[[:space:]]+|[[:space:]]+$/, "", ref)
			if (ref == "") return ""
			if (substr(ref, 1, 1) == "/") return normalize_path(substr(ref, 2))
			return normalize_path(docdir "/" ref)
		}

		# Populate has_slug[file, slug] for every heading in file, applying
		# GitHubs -1, -2, duplicate-suffix behavior, exactly once per file no
		# matter how many anchor references target it. Mirrors the old bash
		# extract_headings/slugify_heading/heading_slugs trio.
		function compute_slugs(file,    line, fence, heading, base, slug, count) {
			if (file in slugs_done) return
			slugs_done[file] = 1
			fence = 0
			while ((getline line < file) > 0) {
				if (line ~ /^```/) { fence = !fence; continue }
				if (fence) continue
				if (line ~ /^#+[[:space:]]/) {
					heading = line
					sub(/^#+[[:space:]]+/, "", heading)
					sub(/[[:space:]]+#+[[:space:]]*$/, "", heading)
					sub(/[[:space:]]+$/, "", heading)
					# GitHub heading-anchor algorithm: lowercase, drop
					# everything that is not a letter/digit/space/hyphen,
					# then turn each space into a hyphen -- one per
					# character, not one per run.
					base = tolower(heading)
					gsub(/[^a-z0-9 -]/, "", base)
					gsub(/ /, "-", base)
					slug = base
					count = 1
					while ((file, slug) in has_slug) {
						slug = base "-" count
						count++
					}
					has_slug[file, slug] = 1
				}
			}
			close(file)
		}

		function has_anchor(file, anchor) {
			compute_slugs(file)
			return ((file, anchor) in has_slug)
		}

		# type == "anchor": raw ref carries the anchor intact (path#anchor or
		# bare #anchor). Validates against the target files real headings.
		function classify_anchor(src, docdir, ref,    hashpos, path, anchor, target, target_file) {
			hashpos = index(ref, "#")
			path = (hashpos > 0) ? substr(ref, 1, hashpos - 1) : ref
			anchor = (hashpos > 0) ? substr(ref, hashpos + 1) : ""
			if (anchor == "") return
			if (path == "") {
				target = src
			} else {
				target = resolve_ref(docdir, path)
				if (target == "") return
				if (!(target in node)) return # file-existence already reported via BROKEN
			}
			target_file = project_dir "/" target
			if (!has_anchor(target_file, anchor)) print "ANCHOR", src, target, anchor
		}

		# type in {related, dependency, content-link}.
		function classify_edge(src, docdir, type, line, ref,    resolved, design_prefix) {
			resolved = resolve_ref(docdir, ref)
			if (resolved == "") return
			if (resolved == src) return # self-link
			if (resolved in node) {
				print "EDGE", src, resolved, type
				return
			}
			design_prefix = design_rel "/"
			if (substr(resolved, 1, length(design_prefix)) == design_prefix && \
				substr(resolved, length(resolved) - 2) == ".md") {
				# In-tree .md target that is not a known doc.
				print "BROKEN", src, resolved, line
			} else if (substr(ref, 1, 1) != "/") {
				# A relative link resolving OUTSIDE the design tree -- source
				# files, READMEs, configs. These were previously not checked
				# at all, so whether a dead link was caught depended only on
				# where its path happened to land, which no author can
				# reason about.
				#
				# Existence is decided by the caller, not here: awk has no
				# stat, and probing with `getline < path` is not merely
				# inaccurate on a directory target but FATAL under the BWK
				# awk that ships as /usr/bin/awk on macOS -- it aborts the
				# whole program mid-stream, so one link to a directory would
				# silently drop every later reference from the report while
				# still exiting 0. The caller re-tests with the `[ -e ]`
				# shell builtin, which costs no fork and treats a directory
				# as the existing path it is.
				print "CANDIDATE", src, resolved, line
			}
		}

		{
			src = $1; docdir = $2; type = $3; line = $4; ref = $5
			if (type == "anchor") classify_anchor(src, docdir, ref)
			else classify_edge(src, docdir, type, line, ref)
		}
	' "$nodes_file" -
	rm -f "$nodes_file"
}

# EDGES lines: from<TAB>to<TAB>type
EDGES=""
# BROKEN lines: from<TAB>intended-target<TAB>line ("0" when the ref came from
# frontmatter, which has no meaningful link line). Carrying the line makes two
# occurrences of the same broken link in one doc two distinct records -- they
# used to collapse under `sort -u`, so fixing "the" broken link could silently
# leave a second copy of it behind.
BROKEN=""
# BROKEN_ANCHORS lines: from<TAB>display-target(empty for same-file)<TAB>anchor
#
# `to` is always populated (never left empty) even for same-file anchors --
# tab is an IFS-whitespace character, so a genuinely empty field between two
# tabs gets squeezed away by bash's field splitting on read, shifting every
# field after it. Same-file links are detected downstream by `to == from`.
BROKEN_ANCHORS=""

# Distribute the tagged awk output into the three record streams. This loop
# runs in-process (here-string, not a pipe), so it costs zero forks no matter
# how many references were classified.
while IFS=$'\t' read -r tag a b c; do
	[ -n "$tag" ] || continue
	case "$tag" in
		EDGE) EDGES+="${a}	${b}	${c}"$'\n' ;;
		BROKEN) BROKEN+="${a}	${b}	${c}"$'\n' ;;
		ANCHOR) BROKEN_ANCHORS+="${a}	${b}	${c}"$'\n' ;;
		# Out-of-tree target awk deliberately left undecided: `[ -e ]` is a
		# builtin, so testing here is free and, unlike awk's getline, it
		# counts a directory as present instead of aborting the run.
		CANDIDATE) [ -e "$PROJECT_DIR/$b" ] || BROKEN+="${a}	${b}	${c}"$'\n' ;;
	esac
done <<<"$(printf '%s' "$REFS" | grep -v '^$' | classify_refs || true)"

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
	#
	# The record arrays are built by `jq` splitting raw TSV rather than by `awk`
	# interpolating into a JSON string template. A path may legitimately contain
	# `"` or `\`, and hand-built JSON would emit an invalid document that `jq`
	# then rejects -- which the `|| true` guard above would silently turn into an
	# empty list. Escaping is jq's job, so let jq do it.
	local nodes_json edges_json broken_json broken_anchors_json orphans_json
	nodes_json="$(printf '%s' "$SCOPE_NODES" | grep -v '^$' | json_array || true)"
	orphans_json="$(printf '%s' "$ORPHANS" | grep -v '^$' | json_array || true)"
	edges_json="$(printf '%s' "$EDGES" | grep -v '^$' |
		jq -R -s 'split("\n") | map(select(length > 0) | split("\t")) | map(select(length >= 3))
			| map({from: .[0], to: .[1], type: .[2]})' || true)"
	broken_json="$(printf '%s' "$BROKEN" | grep -v '^$' |
		jq -R -s 'split("\n") | map(select(length > 0) | split("\t")) | map(select(length >= 2))
			| map({from: .[0], to: .[1], line: ((.[2] // "0") | tonumber)})' || true)"
	broken_anchors_json="$(printf '%s' "$BROKEN_ANCHORS" | grep -v '^$' |
		jq -R -s 'split("\n") | map(select(length > 0) | split("\t")) | map(select(length >= 3))
			| map({from: .[0], to: .[1], anchor: .[2]})' || true)"
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
