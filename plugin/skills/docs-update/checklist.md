# Documentation Update Checklist

Use this checklist to track progress through a documentation update.

## Pre-Update

- [ ] Branch is ready for merge (tests pass, lint clean)
- [ ] All code changes are complete
- [ ] No pending work that would affect documentation

## Phase 1: Package Foundation

### package.json Review

- [ ] `name` - Scoped and formatted correctly
- [ ] `description` - Clear and searchable
- [ ] `license` - Valid SPDX identifier
- [ ] `repository` - Points to correct repo
- [ ] `homepage` - Points to docs or repo
- [ ] `bugs` - Issue tracker URL
- [ ] `author` - Name and email present
- [ ] `keywords` - Relevant search terms
- [ ] `engines` - Node version specified

### package.json Dependencies

- [ ] No dev tools in `dependencies`
- [ ] No runtime deps in `devDependencies`
- [ ] `peerDependencies` have appropriate ranges
- [ ] No `*` or `latest` version ranges
- [ ] **DID NOT modify `version` field**

## Phase 2: Core Documentation

### README.md

- [ ] Badges present and accurate
- [ ] Problem statement is clear
- [ ] Features list current (3-5 bullets)
- [ ] Installation command correct
- [ ] Quick start example works
- [ ] Links to docs/ for advanced usage
- [ ] Under 500 words

### CONTRIBUTING.md

- [ ] Node version matches package.json
- [ ] Package manager version current
- [ ] All listed commands exist in scripts
- [ ] Code quality standards accurate
- [ ] DCO requirement documented

### SECURITY.md

- [ ] Supported versions accurate
- [ ] Security contact email valid
- [ ] Reporting process clear
- [ ] Response timeline stated

## Phase 3: Extended Documentation

### docs/ folder

- [ ] Checked if design docs exist
- [ ] Architecture docs current (if applicable)
- [ ] Guides reflect current API (if applicable)
- [ ] Examples work (if applicable)

## Phase 4: Cross-Reference Validation

### Link Validation

- [ ] All internal markdown links work
- [ ] No broken anchors
- [ ] External links accessible

### Version Consistency

- [ ] README badges use correct package name
- [ ] CONTRIBUTING versions match package.json
- [ ] SECURITY versions match support policy

### Example Validation

- [ ] Imports match actual exports
- [ ] Examples are syntactically valid
- [ ] API usage is current

## Post-Update

- [ ] Ran markdownlint on all changed files
- [ ] Reviewed diff for unintended changes
- [ ] Summary report generated
- [ ] Ready for merge

## Summary Template

Copy and fill in after completion:

```markdown
## Documentation Update Summary

**Module:** {package name}
**Date:** {date}
**Branch:** {branch name}

### Files Updated

| File | Status | Changes |
| ---- | ------ | ------- |
| package.json | {status} | {changes} |
| README.md | {status} | {changes} |
| CONTRIBUTING.md | {status} | {changes} |
| SECURITY.md | {status} | {changes} |
| docs/ | {status} | {changes} |

### Issues Fixed

1. {issue and fix}
2. {issue and fix}

### Issues for Manual Review

1. {file and line}: {issue}

### Validation Results

| Check | Result |
| ----- | ------ |
| Internal links | {result} |
| Version consistency | {result} |
| Example syntax | {result} |
```

## Status Legend

- ✅ Updated - Changes made
- ✅ No changes - Already current
- ⏭️ Skipped - Not applicable
- ⚠️ Needs review - Requires human judgment
- ❌ Failed - Issue found, not fixed
