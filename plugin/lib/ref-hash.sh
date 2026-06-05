#!/usr/bin/env bash
# ref-hash.sh — emit a deterministic content hash of a design doc's body.
#
# The hash covers the document body only; a leading YAML frontmatter block
# (--- ... --- at the very top of the file) is stripped first. Excluding
# frontmatter means routine `updated` / `last-synced` timestamp bumps do NOT
# change the hash — only real content edits do. This is what lets check-refs
# distinguish "the pointer's target drifted" from "someone touched a date".
#
# Both the record side (context-doc-agent maintaining .claude/design/refs.json)
# and the check side (context-validate / context-audit) MUST hash via this
# script so the two hashes are computed identically. Any divergence produces a
# permanent false-positive drift warning.
#
# Modes:
#   ref-hash.sh <file>                  print the lowercase hex sha256 of <file>'s body
#   ref-hash.sh --record <src> <target> print a full refs.json entry (JSON object)
#                                        for pointer <src> -> <target>, stamped
#                                        with today's date. Removes the manual
#                                        "assemble JSON + set recordedAt" steps.
#
# Output: stdout, no trailing newline (hash mode) / pretty JSON (record mode)
# Exit:   0 ok · 1 file missing / no hash utility · 2 bad arguments
set -euo pipefail

# hash_body <file> — emit lowercase hex sha256 of the file body (frontmatter stripped).
hash_body() {
	local file="$1"
	if [[ ! -f "$file" ]]; then
		echo "ref-hash: file not found: $file" >&2
		exit 1
	fi
	# Strip a leading YAML frontmatter block. If the first line is not `---`,
	# the whole file is treated as body.
	local body
	body="$(awk '
		NR==1 && $0=="---" { in_fm=1; next }
		in_fm && $0=="---" { in_fm=0; next }
		in_fm { next }
		{ print }
	' "$file")"
	if command -v shasum >/dev/null 2>&1; then
		printf '%s' "$body" | shasum -a 256 | cut -d' ' -f1 | tr -d '\n'
	elif command -v sha256sum >/dev/null 2>&1; then
		printf '%s' "$body" | sha256sum | cut -d' ' -f1 | tr -d '\n'
	else
		echo "ref-hash: no sha256 utility found (need shasum or sha256sum)" >&2
		exit 1
	fi
}

if [[ "${1:-}" == "--record" ]]; then
	if [[ $# -ne 3 ]]; then
		echo "usage: ref-hash.sh --record <source> <target>" >&2
		exit 2
	fi
	source="$2"
	target="$3"
	hash="$(hash_body "$target")"
	today="$(date +%Y-%m-%d)"
	# Emit a single refs.json entry. No jq dependency for the single-entry form.
	printf '{\n\t"source": "%s",\n\t"target": "%s",\n\t"hash": "%s",\n\t"recordedAt": "%s"\n}\n' \
		"$source" "$target" "$hash" "$today"
	exit 0
fi

if [[ $# -ne 1 ]]; then
	echo "usage: ref-hash.sh <file>   |   ref-hash.sh --record <source> <target>" >&2
	exit 2
fi

hash_body "$1"
