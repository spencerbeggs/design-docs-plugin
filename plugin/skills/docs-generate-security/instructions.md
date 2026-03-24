# SECURITY.md Generation Instructions

Detailed step-by-step instructions for generating SECURITY.md files.

## Core Principle

**Keep it simple - most projects only support the latest version.**

Security policies don't need to be complex. The goal is to tell security
researchers how to report issues and which versions are supported.

## Implementation Steps

### Step 1: Read Package Configuration

```bash
# Read package.json
cat package.json
```

Extract:

- `name` → Package name for title
- `version` → Current version
- `author.email` → Default security contact
- `repository.url` → For GitHub security advisories

### Step 2: Determine Version Support Policy

**Check current version:**

```javascript
const version = packageJson.version;
const [major, minor, patch] = version.split('.').map(Number);
```

**Version support rules:**

| Version Pattern | Support Policy |
| --------------- | -------------- |
| `0.0.0` | "Latest" only (unreleased) |
| `0.x.x` | "Latest" only (pre-release) |
| `1.x.x+` | Current major version |

**For stable versions (≥1.0.0):**

```markdown
| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |
| < 1.0   | :x:                |
```

**For pre-release versions (<1.0.0):**

```markdown
| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |
```

### Step 3: Check for Pending Changesets

If `.changeset/` directory exists:

```bash
# Check for pending changesets
ls .changeset/*.md 2>/dev/null | grep -v README
```

**Parse changeset files to determine next version:**

Changeset files contain YAML frontmatter with bump type:

```yaml
---
"@scope/package": minor
---

Description of the change
```

**Calculate next version:**

| Current | Bump Type | Next Version |
| ------- | --------- | ------------ |
| 1.2.3 | patch | 1.2.4 |
| 1.2.3 | minor | 1.3.0 |
| 1.2.3 | major | 2.0.0 |

If pending changesets exist, mention both current and upcoming:

```markdown
| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | Until 2.0 release  |
```

### Step 4: Determine Security Contact

**Priority order:**

1. `--email` parameter (if provided)
2. `package.json` → `author.email`
3. `package.json` → `maintainers[0].email`
4. Derive from repository: `security@{org}.{tld}`

**For GitHub repositories:**

Also mention GitHub Security Advisories if repository is on GitHub:

```markdown
You can also use [GitHub Security Advisories](https://github.com/{org}/{repo}/security/advisories/new)
to report vulnerabilities privately.
```

### Step 5: Generate Content

**Standard sections:**

1. **Supported Versions** - Version support table
2. **Reporting a Vulnerability** - Contact info and process
3. **What to Include** - Requested information
4. **Response Timeline** - Expected turnaround

### Step 6: Write Output

Write to repository root:

```bash
# Write SECURITY.md
cat > SECURITY.md <<'EOF'
{generated content}
EOF
```

### Step 7: Validate Output

Check that:

- Email address is valid format
- Version table is accurate
- Markdown is valid

## Content Guidelines

### Tone

- Professional and reassuring
- Clear instructions
- Specific timelines

### What to Include

- Supported versions table
- Security contact email
- What to include in reports
- Response timeline (typically 72 hours acknowledgment)
- Credit policy (optional)

### What NOT to Include

- Detailed internal security procedures
- Specific vulnerability details
- Legal disclaimers (keep separate)

## Version Detection Examples

### Example 1: Pre-release Package

**package.json:**

```json
{
  "version": "0.5.2"
}
```

**Output:**

```markdown
| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |
```

### Example 2: Stable Package

**package.json:**

```json
{
  "version": "2.3.1"
}
```

**Output:**

```markdown
| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |
| < 1.0   | :x:                |
```

### Example 3: With Pending Major Bump

**package.json:**

```json
{
  "version": "1.5.0"
}
```

**Changeset:**

```yaml
---
"@scope/package": major
---
Breaking change description
```

**Output:**

```markdown
| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: (upcoming) |
| 1.x     | :white_check_mark: (current)  |
| < 1.0   | :x:                |
```

### Example 4: Monorepo

For monorepos with multiple packages at different versions:

```markdown
| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |

This repository contains multiple packages. Security updates are applied to
the latest version of each package.
```

## Template Placeholders

- `{package.name}` → Package or repo name
- `{security.email}` → Security contact email
- `{versions.table}` → Supported versions table
- `{github.advisories}` → GitHub security advisories link (if applicable)

## Error Handling

### No Email Found

```text
Warning: No security contact email found
Using default: security@{domain from repository}
```

### Invalid Version

```text
Warning: Could not parse version '{version}'
Defaulting to "Latest" support policy
```

### No Repository URL

```text
Note: No repository URL found
Skipping GitHub Security Advisories mention
```
