---
"design-docs": minor
---

## Features

* `/design-docs:design-groom` — autonomous top-to-bottom design-doc overhaul: validates, restyles, resyncs against code, prunes stale context, splits oversized docs, reconciles cross-references, updates CLAUDE.md references, then commits (no push). Runs unattended.
* `/design-docs:design-split` — splits an oversized design doc into atomic, cross-referenced pieces; available to the design-doc-agent and on demand.

## Bug Fixes

* `allow-design-writes` hook now auto-approves `CLAUDE.md` writes, so the grooming pass can run unattended.
* Corrected the `allow-design-writes` hook path referenced by the context-doc-agent and user-docs agents.
