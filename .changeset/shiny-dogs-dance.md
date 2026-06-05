---
"design-docs": minor
---

## Features

### Pointer Content-Drift Detection

`context-validate` and `context-audit` now detect when a design-doc pointer resolves to the right path but the target document's *body* has changed since the pointer's "Load when" guidance was written. Path resolution passing is no longer sufficient — the content behind the pointer is also verified.

The check works through a new shared script `plugin/lib/ref-hash.sh`, which produces a deterministic SHA-256 of the document body with frontmatter stripped. A turnkey recorder, `plugin/lib/refs-record.sh`, walks every `@` pointer in a CLAUDE.md and upserts its `.claude/design/refs.json` entries in one shot (and `ref-hash.sh --record <source> <target>` emits a single dated entry), so the `context-doc-agent` no longer hand-assembles JSON. During validation, each `@` pointer's current hash is compared against the recorded value:

- **Hashes match** — in sync, pass.
- **Hashes differ** — WARNING: "pointer may be stale (content drift)" — the link resolves, but the doc changed since guidance was written.
- **No recorded hash** — INFO by default; WARNING when `quality.context.requirePointerHashes` is `true`.

A new config flag, `quality.context.requirePointerHashes` (default `false`), controls the strictness level for untracked pointers:

```json
{
  "quality": {
    "context": {
      "requirePointerHashes": true
    }
  }
}
```

When `requirePointerHashes` is `true`, any pointer without a recorded hash in `refs.json` produces a WARNING instead of INFO, pushing all pointers to become drift-tracked.

### `finalize --split-docs` Flag

The `finalize` skill's squash step now accepts a `--split-docs` flag that produces two commits instead of one — a functional commit (`review-focus: primary`) and an ancillary docs/changeset commit (`review-focus: ancillary`) — as a review-time focus signal for agent reviewers. Without the flag, the default is a single squash commit (unchanged from before). The `--split-docs` flag has no effect when `--no-squash` is also set.

```text
/design-docs:finalize --split-docs
```

Both commits collapse into one at squash-merge. The split is purely a signal for reviewer context, not a permanent history artifact.

## Bug Fixes

### Unified Word-Count Limit Across Context Skills

All context skills now measure the same thing when enforcing size limits. Previously, `context-validate` and `context-audit` measured **words** while `context-review`, `context-split`, `context-update`, and the `context-doc-agent` measured **non-blank lines** — causing the same file to pass one skill's check and fail another's.

The standard is now **words** across all skills and the agent, matching the defaults already used by `context-validate` and `context-audit` (root: 2000 words, child: 1000 words). If your `design.config.json` uses the old `rootMaxLines` / `childMaxLines` fields, migrate to `rootMaxWords` / `childMaxWords`:

```json
{
  "quality": {
    "context": {
      "rootMaxWords": 2000,
      "childMaxWords": 1000
    }
  }
}
```

`context-validate` and `context-audit` also now emit a one-line note when default limits are in effect (no `design.config.json` found), so it is clear which threshold is being applied.

### finalize Runs on Branches With Only Uncommitted Work

`finalize` no longer stops at its empty-diff check when a branch has zero commits ahead of the base but a dirty working tree. It now treats the uncommitted changes as the work to finalize (committing them in the squash step) and only reports "nothing to finalize" when there are no commits ahead **and** the tree is clean.

### Single-Package Repos No Longer Misdetected as Monorepos

`user-docs-detect-shape` previously classified any repo with a `workspaces` field as `monorepo-root`. A self-referential `workspaces: ["."]` on a `private: true` root with no real sub-packages (for example a Claude Code plugin repo) is now correctly classified as `single`, so downstream README and badge guidance is appropriate for the repo.

### design-sync Flags Stale Config Snippets in Design Docs

`design-sync` now detects design-doc prose that transcribes `design.config.json` keys/values and flags it when it diverges from the live config, recommending a pointer to the file instead. The design-doc style rule discourages embedding config shape as a second source of truth.
