# Examples

## Example 1: Simple section split

**Before:**

- CLAUDE.md: 2348 words (8 sections)

**After:**

- CLAUDE.md: 480 words (overview + navigation)
- CLAUDE.commands.md: 380 words
- CLAUDE.architecture.md: 720 words
- CLAUDE.tooling.md: 440 words
- CLAUDE.testing.md: 330 words

## Example 2: Topic-based split

**Before:**

- pkgs/plugin/CLAUDE.md: 1824 words

**After:**

- CLAUDE.md: 380 words (overview)
- CLAUDE.transformers.md: 580 words (transformer system)
- CLAUDE.generators.md: 512 words (generation logic)
- CLAUDE.config.md: 352 words (configuration)

## Example 3: Custom split (partial)

**Before:**

- CLAUDE.md: 2092 words

**User request:** "Just extract the Testing section, it's huge"

**After:**

- CLAUDE.md: 1604 words (removed testing section)
- CLAUDE.testing.md: 488 words (testing only)
