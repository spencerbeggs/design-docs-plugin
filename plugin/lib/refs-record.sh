#!/usr/bin/env bash
# refs-record.sh — record/refresh every design-doc pointer hash for a CLAUDE.md.
#
# Walks the `@./.claude/design/...md` pointers in a context file, resolves each
# relative to that file's directory, hashes the target body via ref-hash.sh,
# and upserts the (source, target) entries into refs.json — replacing any
# previous entries for the same source and leaving other sources untouched.
# This is the turnkey inverse of the check-side drift loop: one command instead
# of "grep pointers, run ref-hash per target, hand-edit JSON, set the date".
#
# Paths in refs.json are repo-root-relative. The repo root is resolved via
# the same env-var chain every other plugin script uses (DESIGN_DOCS_PROJECT_DIR
# → CLAUDE_PROJECT_DIR → git toplevel → cwd), so the recorder works from any
# working directory inside the project.
#
# Usage:  refs-record.sh <claude-md> [refs.json]
#         (refs.json defaults to <repo-root>/.claude/design/refs.json)
# Exit:   0 ok · 1 source missing / no jq / unresolvable pointer · 2 bad arguments
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REF_HASH="$SCRIPT_DIR/ref-hash.sh"

repo_root="${DESIGN_DOCS_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-}}"
if [[ -z "$repo_root" ]]; then
	repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
# Canonicalize with pwd -P: prefix-stripping below compares against absolute
# doc paths whose symlinks the kernel has resolved (e.g. macOS /var/folders →
# /private/var), and plain pwd would keep the logical, unresolved form.
repo_root="$(cd "$repo_root" 2>/dev/null && pwd -P || pwd -P)"

if [[ $# -lt 1 || $# -gt 2 ]]; then
	echo "usage: refs-record.sh <claude-md> [refs.json]" >&2
	exit 2
fi

source_file="$1"
refs="${2:-$repo_root/.claude/design/refs.json}"

if [[ ! -f "$source_file" ]]; then
	echo "refs-record: source not found: $source_file" >&2
	exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
	echo "refs-record: jq is required" >&2
	exit 1
fi

today="$(date +%Y-%m-%d)"
base_dir="$(cd "$(dirname "$source_file")" && pwd -P)"
src_rel="${base_dir#"$repo_root"/}/$(basename "$source_file")"
# When the source IS at repo root, the prefix strip leaves base_dir unchanged.
[[ "$base_dir" == "$repo_root" ]] && src_rel="$(basename "$source_file")"

# Collect @-pointers to design docs (strip leading @). Tolerate "no match".
rel_targets=()
while IFS= read -r line; do
	[[ -n "$line" ]] && rel_targets+=("$line")
done < <(grep -oE '@[^ )`"]+\.claude/design/[^ )`"]+\.md' "$source_file" | sed 's/^@//' || true)

# Resolve each pointer (relative to the source file's dir) to a repo-root-relative path.
resolved=()
if [[ ${#rel_targets[@]} -gt 0 ]]; then
	for rel in "${rel_targets[@]}"; do
		abs="$base_dir/$rel"
		d="$(cd "$(dirname "$abs")" 2>/dev/null && pwd -P)" || {
			echo "refs-record: cannot resolve pointer '$rel' (target directory missing)" >&2
			exit 1
		}
		full="$d/$(basename "$abs")"
		resolved+=("${full#"$repo_root"/}")
	done
fi

# Dedupe on the RESOLVED target paths, not the raw pointer strings: two
# differently-written pointers (e.g. with `./` or `../` segments) can resolve
# to the same file and must produce a single refs.json entry.
targets=()
if [[ ${#resolved[@]} -gt 0 ]]; then
	while IFS= read -r t; do
		[[ -n "$t" ]] && targets+=("$t")
	done < <(printf '%s\n' "${resolved[@]}" | sort -u)
fi

# Seed refs.json if absent.
if [[ -f "$refs" ]]; then
	doc="$(cat "$refs")"
else
	doc='{"version":1,"refs":[]}'
fi

# Drop this source's existing entries, then add a fresh one per resolved target.
# Keep the pre-drop document so we can carry forward the prior recordedAt for any
# entry whose content hash is unchanged — restamping only when the body drifted
# makes the recorder safe to run idempotently as a verification step.
orig="$doc"
doc="$(jq --arg src "$src_rel" '.refs |= map(select(.source != $src))' <<<"$doc")"
if [[ ${#targets[@]} -gt 0 ]]; then
	for t in "${targets[@]}"; do
		h="$(bash "$REF_HASH" "$repo_root/$t")"
		# Reuse the recorded date when an entry with the same source, target, and
		# hash already existed; only an actual content change earns today's date.
		prev="$(jq -r --arg src "$src_rel" --arg tgt "$t" --arg h "$h" \
			'first(.refs[] | select(.source == $src and .target == $tgt and .hash == $h) | .recordedAt) // empty' \
			<<<"$orig")"
		d="${prev:-$today}"
		doc="$(jq --arg src "$src_rel" --arg tgt "$t" --arg h "$h" --arg d "$d" \
			'.refs += [{source:$src,target:$tgt,hash:$h,recordedAt:$d}]' <<<"$doc")"
	done
fi

# Stable order; tab indent to match the repo's JSON style.
jq --tab '.refs |= sort_by(.source, .target)' <<<"$doc" >"$refs"

echo "refs-record: recorded ${#targets[@]} pointer(s) for $src_rel in $refs" >&2
