# Validation Checks

Full per-file check specifications for step 4 (Validate Each File) of
[instructions.md](instructions.md).

## 4.1 Structure Validation

**Required Sections (Root CLAUDE.md):**

- Project Overview
- Commands (or equivalent)
- Architecture (or Development Notes)
- Tooling (or equivalent)

**Required Sections (Package CLAUDE.md):**

- Package Overview (or similar)
- API Documentation (or Key Exports)
- Development Notes (or Architecture)
- Testing (or Quality)

**Validation:**

- All required sections present
- Sections in logical order
- No duplicate sections
- Proper heading hierarchy (H1 → H2 → H3)

## 4.2 Formatting Validation

**Markdown Quality:**

- Valid markdown syntax
- Proper heading levels (no skipped levels)
- Code blocks have language identifiers
- Lists are properly formatted
- Tables are properly formatted (if present)

**Word Count:**

- Root: ≤ 2000 words (configurable)
- Package: ≤ 1000 words (configurable)
- Flag violations with severity

**Organization:**

- Content is well-structured with clear sections
- Related information grouped together
- No redundant or duplicate content
- Imperative, lean instructions (no fluff)

## 4.3 Content Quality

**Project/Package Overview:**

- Clearly states purpose
- Brief and focused (1-3 paragraphs)
- Not generic boilerplate
- Actually describes this specific project/package

**Commands Section:**

- Lists actual commands that work
- Includes clear descriptions
- No outdated commands
- Commands are relevant to AI assistant

**Architecture/Development Notes:**

- Provides useful context for development
- Not overly verbose
- Includes relevant file paths
- Mentions key patterns or conventions

**Design Doc References:**

If `requireDesignDocPointers: true`, validate:

- Design docs are referenced when appropriate
- References use correct format: `@./.claude/design/{module}/{doc}.md`
- Referenced files actually exist
- Clear guidance on when to load design docs

## 4.4 Quality Checks (Strict Mode)

When `strict: true`, perform additional checks:

**Conciseness:**

- No unnecessarily verbose explanations
- Imperative instructions, not prose
- No marketing speak or sales language
- Focused on actionable information

**Relevance:**

- All content is relevant to AI assistant
- No human-only information (unless necessary)
- No outdated information
- Commands and paths are current

**Specificity:**

- Specific file paths, not vague references
- Actual command examples, not pseudocode
- Concrete patterns, not abstract principles
- Real constraints, not hypotheticals

**Design Doc Integration:**

- Design docs mentioned where they add value
- Not mentioned for trivial details
- Clear when-to-load guidance
- Pointers are up-to-date

## 4.5 Cross-Reference Validation

If `check-refs: true`, validate:

**Design Doc References:**

- Extract all `@./.claude/design/...` references
- Verify each referenced file exists
- Check for broken paths
- Warn if design doc not in module's config

**Pointer Content Drift:**

Existence is necessary but not sufficient. A pointer can resolve to the right path while the target doc's *content* has drifted from what the pointer's "Load when" guidance was written against (e.g. the doc was edited in place, same path). Detect this with the recorded content hash:

1. Load `.claude/design/refs.json` (the pointer↔doc integrity manifest). If it does not exist, skip drift checks and emit one INFO that pointer hashes are not yet tracked.
2. For each `@` pointer, compute the target's current body hash:

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/lib/ref-hash.sh" <target-doc>
   ```

   The script hashes the doc body only (frontmatter stripped), so routine `updated` / `last-synced` bumps never count as drift.
3. Look up the recorded entry for `(source, target)` in `refs.json`:
   - **Recorded hash == current hash** → in sync, pass.
   - **Recorded hash != current hash** → WARNING "pointer may be stale" (see [error-messages.md](error-messages.md)). The link resolves but the target changed since the guidance was recorded.
   - **No recorded entry** → INFO by default; WARNING if `quality.context.requirePointerHashes` is `true`.

**File Path References:**

- Extract references to source files (e.g., `src/foo.ts`)
- Spot-check that paths exist
- Warn about likely outdated paths

**Command References:**

- Extract command examples
- Basic validation (no obvious typos)
- Check for deprecated commands

## 4.6 Markdown Linting

Run markdown linter:

```bash
pnpm lint:md --config './lib/configs/.markdownlint-cli2.jsonc' -- {file-path}
```

Report any linting errors with line numbers.
