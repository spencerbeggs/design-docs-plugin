---
"design-docs": minor
---

## Features

### Model-invokable finalize skill

`/design-docs:finalize` now runs when the model recognizes end-of-branch phrases. Trigger phrases such as "finalize this branch", "wrap up", "ship it", "ready to merge — run the prep", and "I'm done with this work, prep it for merge" automatically route to the skill. `/design-docs:review` and `/design-docs:merge-prep` remain user-invocable only.

### Agent-dispatch architecture for doc steps

Steps 3–5 of the finalize pipeline now dispatch the bundled documentation agents (`design-doc-agent`, `context-doc-agent`, `user-docs`) via the `Agent` tool instead of invoking individual sub-skills directly. Each agent loads its matching `*-docs-style` skill automatically, tightening style enforcement across the full pipeline.

### Documentation agent color badges

`design-doc-agent`, `context-doc-agent`, and `user-docs` now carry `color` metadata for transcript badge identification (red, pink, and blue respectively). Each agent also declares its matching style skill so it auto-loads on dispatch.

## Breaking Changes

The `--docs-only` flag has been removed from `/design-docs:finalize`. Replace it with the two new negative-form skip flags:

| Old | New |
| :--- | :--- |
| `--docs-only` | *(no equivalent — run the full pipeline or use the skip flags below)* |
| *(n/a)* | `--no-context-docs` — skips CLAUDE.md updates |
| *(n/a)* | `--no-user-docs` — skips user-facing doc updates |

`--no-push` and `--no-pr` are now separate flags with distinct semantics: `--no-push` keeps the work local (skip step 8 entirely), while `--no-pr` pushes the branch but skips PR creation (useful when CI or a separate tool opens the PR). `--no-squash` and `--dry-run` are unchanged.
