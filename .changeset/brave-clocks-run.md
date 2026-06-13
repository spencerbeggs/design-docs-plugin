---
"design-docs": patch
---

## Bug Fixes

- Fixed `design-link`: the skill now runs a deterministic script that reliably produces a cross-reference graph (references, broken links, orphans, bidirectional pairs; `--format=text|json|mermaid`). Previously the model could free-form and return unrelated output such as a code review instead of the graph.
- Fixed `design-validate`: recommended-section warnings now honor `quality.designDocs.minSections` from `design.config.json` instead of a hardcoded `Overview`/`Current State`/`Rationale` list. An empty array disables required-section checking entirely.
- Fixed `refs-record.sh`: the script is now idempotent. It preserves an entry's `recordedAt` when the target content hash is unchanged and only restamps the date when the body actually changed, making it safe to run repeatedly as a verification step.
- Removed the inert `quality.designDocs.maxLineLength` config key from `design-docs.schema.json` and the `design-config` documentation. The setting enforced nothing (markdownlint MD013 is disabled and design docs use one-sentence-per-line prose).
