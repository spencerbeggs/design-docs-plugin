# Package.json Review Instructions

Detailed checklist for reviewing package.json files.

## Critical Rule

**NEVER modify the `version` field.**

The version is managed by changesets. Any version-related findings should be
reported but never auto-fixed.

## Review Checklist

### 1. Package Identity

**name** (required)

```json
// Good - scoped package
"name": "@savvy-web/my-package"

// Acceptable - unscoped
"name": "my-package"

// Bad - generic or unclear
"name": "utils"
```

Check:

- [ ] Scoped name for organizational packages
- [ ] Lowercase with hyphens (no underscores)
- [ ] Descriptive and unique
- [ ] Matches directory name (convention)

**version** (DO NOT MODIFY)

- [ ] Present and valid semver
- [ ] Report if `0.0.0` (not yet released)
- [ ] Never suggest changes (changesets handles this)

**description** (required)

```json
// Good - clear and searchable
"description": "Dynamic commitlint configuration with auto-detection"

// Bad - too vague
"description": "A package"
```

Check:

- [ ] Present and non-empty
- [ ] Under 120 characters
- [ ] Contains searchable keywords
- [ ] No marketing fluff

### 2. Repository Metadata

**repository** (recommended)

```json
// Good - object form
"repository": {
  "type": "git",
  "url": "https://github.com/org/repo.git"
}

// Acceptable - shorthand
"repository": "github:org/repo"
```

Check:

- [ ] Present for published packages
- [ ] URL is valid and accessible
- [ ] Matches actual repo location

**homepage** (recommended)

```json
"homepage": "https://github.com/org/repo#readme"
```

Check:

- [ ] Points to documentation or landing page
- [ ] URL is valid
- [ ] Different from repository (if docs exist separately)

**bugs** (recommended)

```json
"bugs": {
  "url": "https://github.com/org/repo/issues",
  "email": "bugs@example.com"
}
```

Check:

- [ ] Points to issue tracker
- [ ] URL format matches repository host

### 3. Author and License

**author** (recommended)

```json
// Good - object form
"author": {
  "name": "Name",
  "email": "email@example.com",
  "url": "https://example.com"
}

// Acceptable - string form
"author": "Name <email@example.com> (https://example.com)"
```

**license** (required)

```json
"license": "MIT"
```

Check:

- [ ] Valid SPDX identifier
- [ ] Matches LICENSE file
- [ ] Appropriate for intended use

### 4. Entry Points

**For ESM packages:**

```json
"type": "module",
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```

**For dual CJS/ESM:**

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "require": "./dist/index.cjs",
    "import": "./dist/index.js"
  }
}
```

Check:

- [ ] `type` field matches file extensions
- [ ] `exports` map is complete
- [ ] `types` condition comes first
- [ ] Fallback `main`/`module` for older bundlers

### 5. Dependencies

**dependencies** - Runtime requirements

```json
"dependencies": {
  "effect": "^3.19.0",
  "zod": "^4.0.0"
}
```

Check:

- [ ] Only runtime dependencies
- [ ] Caret ranges (`^`) for flexibility
- [ ] No dev tools (typescript, vitest, etc.)
- [ ] No duplicates with devDependencies

**devDependencies** - Build and test tools

```json
"devDependencies": {
  "typescript": "^5.9.0",
  "vitest": "^4.0.0"
}
```

Check:

- [ ] Build tools present
- [ ] Test framework present
- [ ] Linting tools present
- [ ] Types packages for untyped deps

**peerDependencies** - Host-provided dependencies

```json
"peerDependencies": {
  "react": "^17.0.0 || ^18.0.0"
}
```

Check:

- [ ] Wide ranges for compatibility
- [ ] Matches actual usage in code
- [ ] peerDependenciesMeta for optional peers

### 6. peerDependency Range Guidelines

**Framework dependencies (React, Vue, etc.):**

```json
// Good - supports multiple majors
"react": "^17.0.0 || ^18.0.0"

// Bad - too narrow
"react": "18.2.0"
```

**TypeScript:**

```json
// Good - wide range
"typescript": ">=4.7.0"

// Better - specific majors tested
"typescript": "^4.7.0 || ^5.0.0"
```

**Build tools (should NOT be peer deps):**

```json
// Wrong - build tools should be devDeps
"peerDependencies": {
  "webpack": "^5.0.0"  // NO
}

// Correct
"devDependencies": {
  "webpack": "^5.0.0"  // YES
}
```

### 7. Engine Requirements

```json
"engines": {
  "node": ">=18.0.0"
}
```

Check:

- [ ] Matches actual minimum supported version
- [ ] Tested against stated minimum
- [ ] Consider LTS versions

### 8. Publishing Configuration

**files** - What to publish

```json
"files": [
  "dist",
  "README.md",
  "LICENSE"
]
```

Check:

- [ ] Includes built output
- [ ] Includes README and LICENSE
- [ ] Excludes source (unless intended)
- [ ] Excludes tests and configs

**publishConfig** - Registry settings

```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

Check:

- [ ] Access level appropriate
- [ ] Registry correct for org

### 9. Scripts

**Essential scripts:**

```json
"scripts": {
  "build": "...",
  "test": "...",
  "lint": "...",
  "typecheck": "..."
}
```

Check:

- [ ] Build script present
- [ ] Test script present
- [ ] Lint script present
- [ ] Prepublish/prepare hooks if needed

## Dependency Version Checks

### When to Suggest Updates

**Suggest update if:**

- Dependency is >2 major versions behind
- Security vulnerability in current range
- Current range excludes important fixes

**Do NOT suggest update if:**

- Current range works and is tested
- Update would require code changes
- Package is intentionally pinned

### How to Check for Updates

```bash
# Check outdated packages
npm outdated

# Or with pnpm
pnpm outdated
```

**Report format:**

```markdown
| Package | Current | Latest | Notes |
| ------- | ------- | ------ | ----- |
| lodash | ^3.0.0 | 4.17.21 | Major update available |
| typescript | ^5.0.0 | 5.9.3 | Up to date |
```

## Common Issues

### Issue: Missing metadata

**Problem:**

```json
{
  "name": "my-package",
  "version": "1.0.0"
  // Missing: description, repository, license, etc.
}
```

**Fix:**

```json
{
  "name": "@scope/my-package",
  "version": "1.0.0",
  "description": "Clear description of what this does",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/org/repo.git"
  },
  "homepage": "https://github.com/org/repo#readme",
  "bugs": "https://github.com/org/repo/issues"
}
```

### Issue: Dependency in wrong section

**Problem:**

```json
"dependencies": {
  "vitest": "^4.0.0"  // Should be devDep
}
```

**Fix:**

```json
"devDependencies": {
  "vitest": "^4.0.0"
}
```

### Issue: peerDependency range too narrow

**Problem:**

```json
"peerDependencies": {
  "react": "18.2.0"  // Exact version
}
```

**Fix:**

```json
"peerDependencies": {
  "react": "^17.0.0 || ^18.0.0"
}
```

### Issue: Missing peerDependenciesMeta

**Problem:**

```json
"peerDependencies": {
  "react": "^18.0.0",
  "@types/react": "^18.0.0"  // Optional but not marked
}
```

**Fix:**

```json
"peerDependencies": {
  "react": "^18.0.0",
  "@types/react": "^18.0.0"
},
"peerDependenciesMeta": {
  "@types/react": {
    "optional": true
  }
}
```

## Report Template

```markdown
## Package Review: {package.name}

### Summary

- **Status**: {✅ Good | ⚠️ Needs Attention | ❌ Issues Found}
- **Completeness**: {X}/10 metadata fields present
- **Dependencies**: {count} deps, {count} devDeps, {count} peerDeps

### Metadata

| Field | Status | Value/Issue |
| ----- | ------ | ----------- |
| name | ✅ | @scope/package |
| description | ✅ | Present |
| repository | ⚠️ | Missing |
| homepage | ⚠️ | Missing |
| bugs | ⚠️ | Missing |
| license | ✅ | MIT |
| author | ✅ | Present |

### Dependencies

{dependency analysis}

### peerDependencies

{peer dependency analysis}

### Recommendations

1. {recommendation 1}
2. {recommendation 2}
3. {recommendation 3}
```
