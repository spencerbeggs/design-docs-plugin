---
status: draft
module: design-docs-plugin
category: meta
created: 2026-07-10
updated: 2026-07-10
last-synced: 2026-07-10
completeness: 90
related: [plugin-architecture.md]
dependencies: []
---

# Design Docs System: The Model vs. Observed Reality

A field study of how the design-docs system is supposed to work, and how it actually behaves in five real repositories of varying size and maturity. Written as brainstorm input for the next iteration of the plugin — this document deliberately stops at diagnosis and an unranked inventory of directions; it commits to nothing.

## Table of Contents

1. [Methodology](#methodology)
2. [Part I: The Envisioned Model](#part-i-the-envisioned-model)
3. [Part II: Observed Reality](#part-ii-observed-reality)
4. [Part III: Diagnosis — Root Causes](#part-iii-diagnosis--root-causes)
5. [Part IV: Direction Inventory (Uncommitted)](#part-iv-direction-inventory-uncommitted)
6. [Appendix: Per-Repo Scorecards](#appendix-per-repo-scorecards)

## Methodology

Five parallel read-only audit agents examined five repos on 2026-07-10, chosen to span the size spectrum: `vitest-bats` (small, 11 source files), `rspress-plugin-api-extractor` (mid-size pnpm monorepo), `effected` (active migration monorepo, 17 design docs), `vitest-agent` (mature multi-package monorepo, 18 design docs), and `savvy-web/systems` (largest: 21 docs across 15 module dirs, 14 CLAUDE.md files). Each agent performed: inventory with frontmatter analysis, git-log freshness comparison of docs vs. the source they describe, at least five concrete claim verifications against source with file:line evidence, refs.json hash recomputation via the plugin's own `ref-hash.sh`, CLAUDE.md pointer and command verification, and structural assessment. Roughly 45 spot-checks and 100+ pointer/hash verifications total.

## Part I: The Envisioned Model

This is the system as designed — the mental model the plugin's skills, hooks, and docs assume.

### The three-layer documentation model

**Design docs** (`.claude/design/<module>/*.md`) are the institutional memory: boundary-level records of architecture, data flows, and the reasoning behind decisions. They document the *current state* of implementation, not history. They carry frontmatter (`status`, `completeness`, `created`, `updated`, `last-synced`, `related`, `dependencies`) that advertises their trustworthiness, and they are loaded on demand — never eagerly.

**Context files** (`CLAUDE.md` at root and in subdirectories) are lean routers: quick-reference commands, hard invariants, and `@`-pointers into the design docs with "load when" triggers. The style rules push content *out* of CLAUDE.md and *into* design docs; CLAUDE.md should orient, not explain.

**Plans** (`.claude/plans/*.md`) are transient implementation state: created by `plan-create` when work starts, tracked through checkboxes and a status field, and *removed* by `plan-complete` when finished — after their durable knowledge is transferred into design docs. Plans are scaffolding; design docs are the building.

### The lifecycle

The envisioned flow: `design-init` scaffolds docs for a module → implementation happens → `design-update`/`design-sync` keep docs aligned as code changes → at end of branch, `finalize` dispatches the design-doc, context-doc, and user-docs agents to reconcile every layer, then squashes and opens a PR → `plan-complete` retires the plan → `merge-prep` ships it. Periodic hygiene skills (`design-audit`, `design-groom`, `design-prune`, `context-audit`) catch anything that slipped through.

### The integrity mechanisms

Four mechanisms are supposed to keep the corpus honest:

1. **refs.json pointer hashing.** Every `@`-pointer from a CLAUDE.md to a design doc gets a body-only sha256 recorded via `refs-record.sh`. If a doc's body changes after recording, validation flags "pointer drift" — the CLAUDE.md may be routing readers to content that changed underneath it.
2. **Frontmatter metadata.** `last-synced` says when a doc was last verified against source; `completeness` scores coverage; `status` (`current`/`draft`/`archived`) gates trust.
3. **Declared policy in `design.config.json`.** Plan schemas (`requireFrontmatter`, `requiredFields`, `validStatuses`), staleness thresholds (`stalenessThresholdDays`, `archiveAfterDays`), validation gates (`validateOnCommit`, `validateOnPR`).
4. **Verification skills.** `design-sync` extracts claims from docs and checks them against source; `design-validate`/`plan-validate`/`context-validate` check structure; `design-audit`/`context-audit` run comprehensive health passes.

### The implicit trust assumptions

The model works if — and only if — several assumptions hold: someone (human or agent) *runs* the verification skills; `refs-record.sh` is re-run after every doc edit; frontmatter is updated when bodies change; `finalize` is used at every branch end so agents reconcile docs; plans are completed rather than abandoned; and declared config policy is enforced by *something*. Part II is largely the story of these assumptions failing.

## Part II: Observed Reality

### What works — the good practices observed

**Design doc content accuracy is high everywhere.** This is the headline positive and it should shape everything else: the core writing conventions produce docs that are *correct*. silk verified 8/8 spot-checks, effected 8/8, vitest-agent 9/10 (zero WRONG findings), vitest-bats 4/4 on design-doc claims. Architecture claims, export maps, data flows, and file paths in design docs overwhelmingly match source.

**The docs-move-with-code pattern works when followed.** In vitest-bats, the breaking `expect.extend` API migration (#7) rewrote all of `package/src` *and* both design docs in the same commit — and those docs remained accurate months later. In effected, most package docs share their exact source commit. When docs ride the implementation commit, they stay true.

**refs.json works perfectly when the recorder actually runs.** vitest-agent: 41 entries, 16/16 target hashes verified byte-clean. The mechanism is sound.

**Pointer discipline holds.** Across all five repos, essentially every `@`-pointer resolves and every quick-reference command maps to a real package.json script (one stale pnpm version aside). The on-demand-loading pattern is being followed, not fought.

**Hub-and-spoke decomposition is the proven pattern at scale.** vitest-agent's corpus — a hub `architecture.md`, per-package `components/*.md`, cross-cutting docs (`data-flows`, `schemas`, `testing-strategy`, `file-structure`), and a `decisions.md` + `decisions-retired.md` sink — was rated exemplary: no monoliths, no orphans, dense bidirectional `related:` graphs. This is the existence proof for "structured thinking about how to break apart architecture."

**Nested CLAUDE.md files can be excellent.** `systems/e2e/CLAUDE.md` was singled out: harness-specific rules, zero duplication of root content, valid design pointer. High-signal hard prohibitions ("never `git checkout` to undo", "never touch `repos/effect-smol`") were repeatedly cited as the most valuable CLAUDE.md content.

**Decision-history capture has real value.** effected's `package-inventory.md`/`releases.md` encode tier corrections, split decisions, and gate rationale; vitest-agent's retired-decisions sink keeps dead reasoning out of live docs without losing it.

### What fails — the not-so-good practices observed

#### Failure 1: Declared policy with no enforcement trigger (the meta-failure)

Nearly every serious finding reduces to this. The plugin *declares* policy in `design.config.json` and *ships* the skills to enforce it, but nothing ever fires them:

- rspress: six plans sat **116 days past** the config's own `archiveAfterDays: 30`. `validateOnCommit`/`validateOnPR` are set; nothing runs them.
- systems: both plans violate the declared `quality.plans` schema (`requireFrontmatter: true`, five `requiredFields`); `plan-validate` would fail both; it never ran.
- vitest-agent: two of three plans use statuses (`active`, `backlog`) that aren't in the config's own `validStatuses` enum.
- systems: `design-split` and `design-index` exist as skills while 400+ line monolith docs and a 21-doc corpus with no index sit unaddressed.

Unenforced policy is worse than no policy: it *reads* as a guarantee while guaranteeing nothing.

#### Failure 2: refs.json rots because recording is manual — and has a recorder bug

- effected: 3/18 entries stale — docs edited 2026-07-10, recorder never re-run (recordedAt still 07-09).
- rspress: 2/15 stale for the same reason (docs edited 07-09, refs recorded 06-26).
- systems: **4/14 hashes mismatch on a clean tree** with `recordedAt` equal to the doc's commit date — the recorder captured a pre-edit body (an ordering bug in the record step, not user error). False drift warnings on a clean tree train users to ignore the one signal the system emits.
- Coverage blind spots even when current: refs.json guards only CLAUDE.md→doc pointers. Doc→doc links (vitest-agent's `architecture.md` → `components/*.md` index) and doc→source claims are unguarded.

#### Failure 3: The plans layer is the worst layer in every repo

No repo had a healthy plans directory:

| Repo | Plans-layer condition |
| --- | --- |
| rspress | Six plans from 2026-03-16, all describing work that **shipped months ago** (verified in source), 0 of ~148 checkboxes checked, no YAML frontmatter, never archived. ~3,900 lines of confident future-tense instructions for already-merged code — the single biggest mislead-an-agent hazard found in the study. |
| effected | 3 of 4 plan statuses contradict git reality: `config-file-port` and `walker-port` say `pending` but both packages merged to main (PRs #18, #26); `glob-port` says `completed` but the file lingers against `plan-complete`'s own removal rule. No `in-progress` value exists, so active work (toml) is indistinguishable from untouched work. |
| vitest-agent | All three plans **gitignored** — invisible to collaborators and CI, so every configured plan-freshness feature is inert. Status-enum violations. A finished release plan ("✅ Done" on nearly every wave, stamped 7 weeks ago) reads as a live worklist. |
| systems | Both plans violate the declared schema; `bidirectionalLinking: true` configured, neither links a design doc. |
| vitest-bats | `.claude/plans/` exists and is empty (dead scaffold); actual planning artifacts accumulate in a *different plugin's* directory (`docs/superpowers/plans/`). |

The recurring shape: merged reality never flows back into plan state. Plans are write-once artifacts in a system that assumes they are living documents.

#### Failure 4: CLAUDE.md is the highest-traffic, least-verified layer

Design docs get `design-sync`, `design-validate`, `design-audit`, and `last-synced`. CLAUDE.md gets structural checks only — and it shows. In vitest-bats, *every* accuracy error in the repo was in a CLAUDE.md:

- `expect(result).toExitWith(0)` — a matcher that does not exist (real API: `toSucceed()`/`toFail(code?)`).
- `toHaveOutput(/HELLO/)` — a RegExp passed to an exact-string-equality matcher; silently never matches. The design docs document this API *correctly* — the context file contradicts the doc it points to, and two sibling CLAUDE.md files disagree with each other on the same API.
- A hand-copied coverage-exclusion list drifted from `vitest.config.ts` (wrong in both directions).

Elsewhere: rspress root CLAUDE.md ships `pnpm --filter` examples that match **no existing package name**, and its workspace table omits two packages that exist on disk — despite being edited the day before the audit. systems' root CLAUDE.md pins `pnpm 11.5.1` vs. actual 11.11.0. vitest-agent's root duplicates a dense versioning paragraph near-verbatim from `architecture.md` (the exact anti-pattern the style rules warn about — two copies that must now be edited in lockstep).

A sharp sub-finding from vitest-bats: **the most recently edited context file was the least accurate**. Recency and correctness are uncorrelated; edits that don't verify claims just re-stamp stale content with a fresh commit date.

#### Failure 5: Self-reported metadata carries no information

- systems: every one of 19 current docs scores `completeness` 85–95 and `status: current` — including `templates/architecture.md`, which carries confirmed-stale dependency claims (`js-yaml` removed in PR #213, doc still describes it). A scale where a verified-wrong doc scores 90 is decoration.
- rspress: `source-mapping-system.md` frontmatter says `updated: 2026-05-26`; git says the body last changed 2026-07-09 — 44 days of self-misreport, which then cascades into refs drift.
- vitest-agent (the healthiest repo): PR #141 changed sdk/plugin source *after* the 07-07 sync; `last-synced` silently trails and nothing surfaces it.

`last-synced`, `updated`, and `completeness` are all declarations. Nothing derives them from, or reconciles them against, observable git state.

#### Failure 6: Decomposition is inconsistent and discovery doesn't scale

- systems (15 modules, 21 docs): only one module decomposed (github-action-effects, 6 docs); everything else is a lone `architecture.md`, with the biggest and most cross-referenced docs (bundler 349 lines/24 H2s, tsdown-plugins 438, silk-effects 474) the least decomposed — several exceed a single Read window.
- No index exists: a cross-cutting change (e.g. dual-format work spanning bundler↔tsdown-plugins↔silk↔changelog) has no entry point; an agent must already know the `related:` frontmatter graph exists and walk it manually.
- Ironically, the one decomposed module (6 docs) was also the *stalest* — decomposition raised maintenance surface without any mechanism keeping the pieces fresh.
- Contrast vitest-agent: hub-and-spoke taxonomy, everything fresh. The difference is not repo size or activity; it is that one corpus had a deliberate shape and the other accreted.

#### Failure 7: Config rot and small-repo ceremony

- rspress: `design.config.json` untouched for 116 days since init; its `skills.enabled`/`subagents` lists reference skills the plugin no longer ships. The config describes the plugin-as-at-init.
- systems: two archived modules still listed as active `modules`, so config-iterating tooling will try to sync retired subsystems.
- vitest-bats: scaffolded artifacts it never uses — empty `plans/`, an all-`false` CI/git stanza, and a fourth CLAUDE.md byte-identical to a sibling. For a small repo, the system's fixed footprint includes pure ceremony.
- vitest-bats: refs.json is simply *absent* and nothing notices — `design.config.json` has no field acknowledging the opt-out, so drift detection is silently off with no signal that it's off.

## Part III: Diagnosis — Root Causes

**1. Pull, not push.** Every integrity mechanism depends on someone remembering to invoke a skill. The repos that stayed healthy (vitest-agent, effected's doc layer) did so because their owner's habits happened to include the pull; the moment attention moved on (rspress plans, systems refs), rot began. The failure rate tracks human attention, not repo complexity. The plugin owns SessionStart and PreToolUse hooks already — the enforcement surface exists; it just isn't used for integrity.

**2. Declared, not derived.** `last-synced`, `updated`, plan `status`, `completeness` — all hand-written assertions about observable facts. Git already knows when a doc body changed, how many source commits landed since the last sync, and whether a plan's target package merged to main. Every place the system asks a human/agent to transcribe reality is a place reality and transcript diverge.

**3. Verification asymmetry across layers.** Instrumentation is inversely proportional to traffic. Design docs (loaded on demand, occasionally) have four verification skills and freshness metadata. CLAUDE.md (loaded *every session*) has structural validation only — no freshness metadata, no claim verification, no example linting. Plans (loaded when resuming work — the highest-stakes moment) have a validator that never runs. The layer most likely to mislead an agent is the least checked.

**4. Prose-to-prose, never prose-to-source.** The one automated integrity check (refs.json) compares documentation to documentation. A doc can pass every existing check while being flat wrong about the code — as systems' bundler doc demonstrated (clean refs, two hard-WRONG claims about its own shipped file paths). `design-sync` *can* check claims against source, but it's a manual skill (see root cause 1), and nothing lightweight runs continuously.

**5. Lifecycle events don't close loops.** Merging a PR is the moment plan status becomes wrong, doc `last-synced` starts aging, and completed plans should retire — and it is precisely the moment where no plugin machinery runs. `finalize` covers the authoring side of branch-end; nothing covers the *consequence* side (reconciling plans and metadata against what just became true).

**6. One size of ceremony.** The same scaffold (plans dir, refs, CI stanzas, multi-level CLAUDE.md) lands on an 11-file package and a 15-module monorepo. Small repos accumulate dead structure; large repos outgrow the flat structure they started with, and nothing nudges either toward its right-sized shape.

## Part IV: Direction Inventory (Uncommitted)

The pooled, deduplicated improvement ideas from all five audits, grouped by theme. Deliberately unranked — direction to be chosen after further thinking.

### A. Enforcement and automation (attacks root causes 1, 5)

- PostToolUse hook: on Write/Edit to `.claude/design/**/*.md`, auto re-run `refs-record.sh` for affected sources (or emit a "pointer drift — re-record" nudge). Fix the recorder ordering bug so recording is the last write step.
- SessionStart staleness digest: over-age plans (`archiveAfterDays`), docs whose source moved past `last-synced`, refs drift count — injected as context so every session starts knowing what's rotten.
- Wire `plan-validate`/`design-validate` into the lifecycle points the config already names (`validateOnCommit`, `validateOnPR`) — pre-commit hook and/or CI recipe.
- Auto-bump `updated`/`last-synced` frontmatter on body change via hook, instead of trusting the author.

### B. Doc↔source drift detection (root cause 4)

- `design-sync --check` cheap mode: `git log <module-path> --since=<last-synced>` → "source moved N commits since last sync" per doc; no LLM needed, hookable.
- Path/export assertion lint: extract doc-asserted file paths and export names, verify against the filesystem; flag WRONG claims like `public/ecma.json`.
- Symbol lint for fenced examples in CLAUDE.md: extract identifier-shaped tokens from code blocks and grep against the module's exported symbols; catches `toExitWith`-class fictions.
- Config-paraphrase detection generalized beyond `design.config.json`: prose that transcribes any config (`vitest.config.ts` coverage lists, workspace tables) is flagged as a second source of truth; recommend pointer-to-config instead.

### C. Plans lifecycle repair (root cause 5)

- `plan-reconcile`: diff each plan's target packages/files/symbols against git reality ("plan says pending but PR #N merged this"; "all described artifacts exist while 0 boxes checked → looks DONE, never completed").
- Add `in-progress` to the default status vocabulary; reconcile the enum with what templates actually emit.
- Integrate plan completion into `finalize`/`merge-prep`: branch-end is when the matching plan should flip or retire.
- Warn when `.claude/plans/` is gitignored (freshness features silently inert) or empty-while-plans-accumulate-elsewhere.
- Enforce plan frontmatter at `plan-create` time — conformant scaffold, not post-hoc validation.

### D. CLAUDE.md verification parity (root cause 3)

- Give CLAUDE.md the same treatment design docs get: freshness metadata (or derived equivalent), claim verification pass in `context-audit`, example linting (B above).
- Cross-file consistency check: near-duplicate examples across sibling CLAUDE.md files get diffed; contradictions and wholesale duplication both surface.
- Duplication lint: high prose overlap between a CLAUDE.md and its `@`-pointed design docs → recommend collapsing to a pointer.

### E. Decomposition doctrine and discovery (root cause 6)

- Codify the vitest-agent taxonomy as the canonical pattern in `design-init`/`design-split` guidance: architecture hub → per-component docs → cross-cutting docs (data-flows, testing-strategy, schemas) → decisions + decisions-retired sink.
- Auto-generated, committed `.claude/design/INDEX.md` (module → doc → status/freshness + `related:` edges), refreshed by hook or by `design-index` wired into `finalize`; SessionStart can point at it.
- Soft doc-size lint: doc exceeds a Read window / N headings → nudge `design-split`.
- Extend refs-style hashing to doc→doc links so decomposed corpora (the hub pattern) keep their internal index verifiable — decomposition must not raise unmonitored surface (the systems 6-doc module lesson).

### F. Derived metadata and honest signals (root cause 2)

- Derive `updated` from git; derive a `drift` indicator from B-style checks; auto-demote `status: current` → `stale` past thresholds.
- Recalibrate or replace `completeness` — a hand-set 85–95 monoculture that scores confirmed-stale docs at 90 conveys nothing. Possibly replace with derived badges (last-verified date, spot-check pass rate).

### G. Right-sizing and config hygiene (root cause 6)

- `profile: minimal` for small repos: suppress plans/refs/CI scaffolding, single CLAUDE.md, warn on byte-identical sibling context files.
- `design-config --verify`: cross-check `skills.enabled`/`subagents`/`modules` against installed plugin inventory and repo state (archived modules still active, referenced skills that no longer exist, refs.json absent-but-unacknowledged).

## Appendix: Per-Repo Scorecards

| Repo | Design docs | CLAUDE.md | Plans | refs.json | Standout finding |
| --- | --- | --- | --- | --- | --- |
| vitest-bats | Excellent (4/4 checks; survived a breaking API change) | **Poor** — every repo error lives here; contradicts own design docs | Dead scaffold (empty; real plans in another plugin's dir) | Absent, silently | Most recently edited file = least accurate |
| effected | Excellent (8/8) | Good (all pointers/commands valid; one over-generalization) | **3 of 4 statuses contradict merged reality** | 3/18 stale (manual recorder never re-run) | Intra-doc contradiction: same doc says both "on feat branch" and "merged" |
| rspress-plugin | Good (architecture accurate; metadata 44 days dishonest) | Mixed — `--filter` examples match no package; 2 workspaces missing | **Six 116-day-old plans for shipped work; 0/~148 boxes; no frontmatter** | 2/15 stale | Config frozen at init; references skills that no longer exist |
| vitest-agent | Excellent (9/10; exemplary hub-and-spoke decomposition) | Good (minor undercount; one duplication anti-pattern) | Gitignored → all freshness features inert; enum violations | **16/16 clean** — proof the mechanism works | Healthiest corpus still has zero doc→source drift signal |
| systems | Good overall; bundler has 2 hard-WRONG path claims; templates stale | Root good (one stale version); coverage gaps in plugins/ | Both violate declared schema | **4/14 drift on a clean tree** (recorder ordering bug) | 21 docs, no index; completeness scale compressed into meaningless 85–95 |
