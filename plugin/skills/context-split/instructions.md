# Instructions

Full step-by-step process for splitting a CLAUDE.md file, plus the strategy
comparison and best practices that inform each step.

## 1. Parse Parameters

Extract parameters from the user's request:

**Required:**

- `file`: Path to CLAUDE.md file to split

**Optional:**

- `strategy`: Split strategy (section | topic | custom)
- `sections`: Specific sections to extract (for custom split)
- `preview`: Show split plan without executing (default: false)

**Examples:**

- "Split the root CLAUDE.md"
  - file: `CLAUDE.md`
  - strategy: `section` (auto-detect)

- "Split pkgs/effect-type-registry/CLAUDE.md by major sections"
  - file: `pkgs/effect-type-registry/CLAUDE.md`
  - strategy: `section`

- "Preview split for CLAUDE.md"
  - file: `CLAUDE.md`
  - preview: true

## 2. Analyze Current File

Read and analyze the CLAUDE.md file:

**Metrics:**

- Total word count
- Word limit (from config: root=2000, package=1000)
- Overage: words over limit
- Number of top-level sections (H2)
- Average words per section

**Structure analysis:**

```bash
# Count sections
grep "^## " CLAUDE.md | wc -l

# Count total words
wc -w CLAUDE.md
```

**Example output:**

```text
Current CLAUDE.md Analysis:

- Total words: 2348
- Limit: 2000
- Overage: 348 words (17% over)
- Sections: 8
- Average words/section: 293
- Recommendation: Split needed
```

## 3. Determine Split Strategy

Based on analysis and request, choose strategy:

### Strategy: Section

Split by major sections (H2 headings):

**When to use:**

- File has clear major sections
- Sections are relatively independent
- Each section is substantial (>200 words)

**How it works:**

1. Identify all H2 sections
2. Group related sections if needed
3. Create one child file per section or group
4. Parent retains overview and references children

**Example sections:**

- Commands → `CLAUDE.commands.md`
- Architecture → `CLAUDE.architecture.md`
- Testing → `CLAUDE.testing.md`

### Strategy: Topic

Split by logical topics that may span sections:

**When to use:**

- Content organized by topics, not sections
- Topics are interleaved in sections
- Need more granular splits

**How it works:**

1. Identify distinct topics
2. Extract all content related to each topic
3. Create one child file per topic
4. Parent becomes navigation hub

**Example topics:**

- Build system → `CLAUDE.build.md`
- Type system → `CLAUDE.types.md`
- Plugin system → `CLAUDE.plugins.md`

### Strategy: Custom

User specifies exactly what to extract:

**When to use:**

- Specific sections are too large
- Custom grouping needed
- Partial split (not all sections)

**How it works:**

1. User specifies sections to extract
2. Create child files as specified
3. Parent keeps remaining content

## 4. Plan the Split

Generate split plan for review:

```markdown
# CLAUDE.md Split Plan

## Current State

- File: CLAUDE.md
- Words: 2348 / 2000 (348 over)
- Sections: 8
- Strategy: section

## Proposed Split

### Parent: CLAUDE.md (480 words)

**Contents:**

- Project Overview
- Quick Reference (commands, paths)
- Child File Navigation

**Sections preserved:**

- Project Overview
- File Organization (new section listing children)

### Child 1: CLAUDE.commands.md (380 words)

**Contents:**

- AI-Friendly Commands
- Standard Commands
- Testing Commands
- Build Commands

**Sections:**

- Commands
- Scripts Reference

### Child 2: CLAUDE.architecture.md (720 words)

**Contents:**

- Monorepo Structure
- Package Architecture
- Build Process
- Design Documentation

**Sections:**

- Architecture
- Development Notes

### Child 3: CLAUDE.tooling.md (440 words)

**Contents:**

- Package Manager
- Linting
- Type Checking
- Testing Framework

**Sections:**

- Tooling

### Child 4: CLAUDE.testing.md (330 words)

**Contents:**

- Testing Strategy
- Test Organization
- Running Tests
- Coverage

**Sections:**

- Testing

## After Split

- Parent: 480 words (~80% reduction)
- Children: 4 files, avg 468 words each
- Total: 5 files instead of 1
- All files under limit ✅

## Navigation

Parent will have:

```markdown
## Documentation Structure

This project's context is split across multiple files:

- **[Commands](./CLAUDE.commands.md)** - AI-optimized commands
- **[Architecture](./CLAUDE.architecture.md)** - System design
- **[Tooling](./CLAUDE.tooling.md)** - Development tools
- **[Testing](./CLAUDE.testing.md)** - Test strategy

Load specific files when working on related tasks.
```

**User confirmation:**

```text
This split will create 4 new files and reduce parent by ~80%.

Proceed with split? (y/n)
```

### 5. Create Child Files

For each planned child file:

#### File Naming

**Convention:**

- `CLAUDE.{topic}.md` for child files
- Keep in same directory as parent
- Lowercase, hyphenated topics

**Examples:**

- `CLAUDE.commands.md`
- `CLAUDE.architecture.md`
- `CLAUDE.api-design.md`
- `CLAUDE.type-system.md`

#### File Structure

Each child file should have:

**Header:**

```markdown
# {Topic} - {Package Name}

Context file for {topic} in {package}.

**Parent:** [Main Context](./CLAUDE.md)

---
```

**Content:**

- Extracted sections with original formatting
- Preserve code blocks, lists, tables
- Maintain heading hierarchy (may adjust levels)
- Keep related content together

**Footer:**

```markdown
---

**Related Context:**

- [Commands](./CLAUDE.commands.md) - If commands needed
- [Architecture](./CLAUDE.architecture.md) - If architecture needed

---

*This is a child context file. See [CLAUDE.md](./CLAUDE.md) for overview.*
```

### 6. Update Parent File

Modify parent CLAUDE.md:

#### Remove Extracted Content

Use Edit tool to remove sections that were moved to children.

#### Add Navigation Section

Add new section directing to child files:

```markdown
## Documentation Structure

This project's context is organized across multiple files for optimal
loading:

**Core Context (This File):**

- Project Overview
- Quick Reference
- File Organization

**Detailed Context (Child Files):**

- **[Commands](./CLAUDE.commands.md)** - All commands and scripts
  - Load when: Running builds, tests, or development tasks
  - Size: 380 words

- **[Architecture](./CLAUDE.architecture.md)** - System architecture
  - Load when: Understanding structure, making architectural changes
  - Size: 720 words

- **[Tooling](./CLAUDE.tooling.md)** - Development tooling
  - Load when: Setting up environment, debugging tool issues
  - Size: 440 words

- **[Testing](./CLAUDE.testing.md)** - Testing strategy and execution
  - Load when: Writing tests, debugging test failures
  - Size: 330 words

**Usage:**

Load child files when working on specific areas. The parent provides
overview and navigation.
```

#### Update Quick Reference

If parent had commands/paths, keep most common ones:

```markdown
## Quick Reference

**Most Used Commands:**

```bash
# Development
pnpm dev

# Testing
pnpm test

# Building
pnpm build
```

**For full command reference:** See [CLAUDE.commands.md](./CLAUDE.commands.md)

## 7. Validate Split Files

After creating all files, validate:

**Word count checks:**

```bash
# Check all files are under limit
wc -w CLAUDE*.md
```

**Parent:**

- Under root/package limit
- Has navigation section
- References all children
- Retains essential overview

**Children:**

- Under limit (ideally <1000 words each)
- Focused on single topic
- Has header with parent reference
- Has footer with related links
- Valid markdown

**Cross-references:**

- All child references in parent are valid
- Parent link in each child works
- Related links between children are valid

## 8. Report Split Results

Provide summary of split:

```markdown
# CLAUDE.md Split Complete

**Original file:** CLAUDE.md
**Strategy:** section

## Files Created

### Parent: CLAUDE.md

- **Words:** 2348 → 480 (~80% reduction)
- **Contents:** Overview, navigation, quick reference
- **Status:** ✅ Under limit (2000)

### Children:

1. **CLAUDE.commands.md** (380 words)
   - Commands, scripts reference
   - Status: ✅ Under limit

2. **CLAUDE.architecture.md** (720 words)
   - Architecture, development notes
   - Status: ✅ Under limit

3. **CLAUDE.tooling.md** (440 words)
   - Tooling configuration
   - Status: ✅ Under limit

4. **CLAUDE.testing.md** (330 words)
   - Testing strategy and execution
   - Status: ✅ Under limit

## Validation

- ✅ All files under word limits
- ✅ Navigation section added to parent
- ✅ Cross-references valid
- ✅ Markdown linting passed
- ✅ No duplicate content

## Usage

Load context files based on task:

- **General work:** CLAUDE.md (overview)
- **Commands:** CLAUDE.commands.md
- **Architecture:** CLAUDE.architecture.md
- **Tooling:** CLAUDE.tooling.md
- **Testing:** CLAUDE.testing.md

## Next Steps

- Review each child file for coherence
- Test loading child files in Claude Code
- Update any external references to sections
- Consider adding to .claudeignore if needed
```

## Split Strategies Comparison

| Strategy | When to Use | Pros | Cons |
| :------- | :---------- | :--- | :--- |
| Section | Clear H2 divisions | Simple, preserves structure | Uneven files |
| Topic | Interleaved topics | Logical grouping | Requires analysis |
| Custom | Specific needs | Full control | Manual work |

## Best Practices

## Optimal Child File Size

- Target: 400-1000 words per child
- Maximum: 1000 words (package limit)
- Minimum: 200 words (too small not worth splitting)

## Content Organization

**Parent should retain:**

- Project overview (1-2 paragraphs)
- Most critical quick reference
- Navigation to children
- When-to-load guidance

**Children should contain:**

- Focused topic content
- Self-contained information
- References to related children
- Link back to parent

## Navigation Quality

Good navigation tells you:

- What each child contains
- When to load each child
- How large each child is
- How children relate to each other

## Avoiding Over-Splitting

Don't split if:

- File is only slightly over limit (< 10%)
- Content is highly interconnected
- Would create too many small files (>6 children)
- Can be reduced by removing redundancy instead
