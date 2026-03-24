# Documentation Update Instructions

Step-by-step guide for comprehensive documentation review and update.

## Execution Order

Follow this exact order to ensure consistency:

```text
1. package.json review → Source of truth for metadata
2. README.md → Uses package.json metadata
3. CONTRIBUTING.md → Uses package.json scripts/engines
4. SECURITY.md → Uses package.json version/author
5. docs/ → Uses all of the above
6. Cross-reference validation → Ensures consistency
```

## Phase 1: Package Foundation

### Step 1.1: Review package.json

Read and analyze the package.json file:

```bash
cat package.json
```

**Metadata checklist:**

| Field | Required | Check |
| ----- | -------- | ----- |
| name | Yes | Scoped, lowercase, hyphens |
| version | Yes | DO NOT MODIFY |
| description | Yes | Clear, searchable |
| license | Yes | Valid SPDX |
| repository | Recommended | Points to repo |
| homepage | Recommended | Points to docs |
| bugs | Recommended | Issue tracker URL |
| author | Recommended | Name and email |
| keywords | Recommended | Relevant terms |
| engines | Recommended | Node version |

**Dependency checklist:**

| Check | Action |
| ----- | ------ |
| Runtime deps in `dependencies` | Move if misplaced |
| Dev tools in `devDependencies` | Move if misplaced |
| Peer deps have wide ranges | Widen if too narrow |
| No `*` or `latest` versions | Pin to range |

### Step 1.2: Fix package.json issues

Apply safe fixes only:

- Add missing metadata fields (repository, bugs, homepage)
- Move misplaced dependencies
- Widen narrow peerDependency ranges

**NEVER modify:**

- `version` field (changesets manages this)
- Dependency versions without explicit request

## Phase 2: Core Documentation

### Step 2.1: README.md

**If README.md exists:**

1. Read current content
2. Compare against package.json
3. Update badges if package name/scope changed
4. Update features if capabilities changed
5. Verify quick start example works
6. Ensure link to docs/ exists

**If README.md missing:**

Generate new README using docs-generate-readme guidance:

- Add badges (npm version, license, node version)
- Write clear problem statement
- List 3-5 features as user benefits
- Add minimal quick start example
- Link to docs/ for advanced usage

**Validation:**

- [ ] Badges reference correct package name
- [ ] Features match current capabilities
- [ ] Quick start imports match actual exports
- [ ] Under 500 words

### Step 2.2: CONTRIBUTING.md

**If CONTRIBUTING.md exists:**

1. Read current content
2. Compare versions against package.json
3. Compare commands against scripts
4. Update if discrepancies found

**If CONTRIBUTING.md missing:**

Generate new CONTRIBUTING.md using docs-generate-contributing guidance:

- Extract Node version from package.json engines
- Extract package manager from packageManager field
- List actual scripts from package.json
- Include DCO requirement

**Validation:**

- [ ] Node version matches package.json engines
- [ ] Package manager version is current
- [ ] All listed commands exist in scripts
- [ ] DCO signoff documented

### Step 2.3: SECURITY.md

**If SECURITY.md exists:**

1. Read current content
2. Verify supported versions match reality
3. Verify contact email is valid

**If SECURITY.md missing:**

Generate new SECURITY.md using docs-generate-security guidance:

- Determine version support policy
- Extract contact from package.json author
- Add GitHub Security Advisories link if applicable

**Validation:**

- [ ] Supported versions accurate
- [ ] Contact email valid
- [ ] Response timeline stated

## Phase 3: Extended Documentation

### Step 3.1: Check for design docs

```bash
ls -la .claude/design/
```

**If design docs exist:**

Consider generating/updating docs/ folder using docs-generate-repo.

**If no design docs:**

Skip Level 2 documentation generation.

### Step 3.2: Update docs/ folder

If docs/ exists and needs updates:

1. Check architecture docs match implementation
2. Verify examples use current API
3. Update version references
4. Fix broken internal links

## Phase 4: Cross-Reference Validation

### Step 4.1: Link validation

Check all markdown links:

```bash
# Find all markdown links
grep -rn '\[.*\](.*\.md)' README.md CONTRIBUTING.md SECURITY.md docs/
```

Verify:

- [ ] All linked files exist
- [ ] Anchors resolve correctly
- [ ] No circular references

### Step 4.2: Version consistency

Cross-check versions across files:

| Location | Should Match |
| -------- | ------------ |
| README badges | package.json name |
| CONTRIBUTING Node version | package.json engines.node |
| CONTRIBUTING pnpm version | package.json packageManager |
| SECURITY supported versions | package.json version |

### Step 4.3: Example validation

For each code example:

1. Check imports match actual exports
2. Verify syntax is valid
3. Confirm API usage is current

```bash
# Find all TypeScript code blocks
grep -A 20 '```typescript' README.md docs/*.md
```

## Output Format

After completing all phases, produce a summary:

```markdown
## Documentation Update Summary

**Module:** @scope/package-name
**Date:** YYYY-MM-DD
**Branch:** feature/xyz

### Files Reviewed

| File | Status | Changes |
| ---- | ------ | ------- |
| package.json | ✅ Updated | Added bugs, homepage |
| README.md | ✅ Updated | Refreshed badges |
| CONTRIBUTING.md | ✅ Updated | Fixed Node version |
| SECURITY.md | ✅ No changes | Already current |
| docs/ | ⏭️ Skipped | No design docs |

### Issues Fixed

1. **package.json**: Added missing `bugs` field
2. **README.md**: Updated npm badge to use correct scope
3. **CONTRIBUTING.md**: Updated Node version from 20 to 24

### Issues for Manual Review

1. **README.md line 45**: Feature list may need human review
2. **docs/api.md line 120**: Complex example needs testing

### Validation Results

| Check | Result |
| ----- | ------ |
| Internal links | ✅ All valid |
| Version consistency | ✅ Consistent |
| Example syntax | ✅ Valid |
| Example imports | ⚠️ 1 needs verification |
```

## Error Handling

### Missing package.json

```text
Error: package.json not found
Cannot proceed without package metadata
```

### Conflicting information

If documentation conflicts with package.json:

1. Trust package.json as source of truth
2. Update documentation to match
3. Flag for human review if unclear

### Custom sections

If files contain custom sections:

1. Identify standard vs custom sections
2. Update only standard sections
3. Preserve custom sections unchanged
4. Note preserved sections in summary
