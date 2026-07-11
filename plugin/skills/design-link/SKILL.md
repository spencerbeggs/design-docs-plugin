---
name: design-link
description: Generate cross-reference graph showing relationships between design documents. Use when visualizing doc dependencies, finding related docs, or understanding documentation structure.
allowed-tools: Read, Glob, Bash(bash *), Bash(jq *)
context: fork
agent: design-doc-agent
---

# Design Documentation Cross-Reference Graph

Generates graphs and reports showing relationships between design documents
based on their frontmatter references and content links.

## Run the Script First

This skill is backed by a deterministic bash script. **Run it and present its
output** — do not hand-build the graph by reading files, and never inspect git
history or review commits. This skill's only job is the design-doc
cross-reference graph; the script guarantees that.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-link/scripts/link.sh" [module|all] [--format=text|json|mermaid]
```

The script discovers docs, parses each doc's `related`/`dependencies`
frontmatter and every in-content relative link (not only `.md` ones), then
reports the reference list, broken links, orphaned docs, and bidirectional vs
one-way pairs. Default scope is
`all`; default format is `text`. Present the script output, then add the
recommendations described below if the user wants them.

## Overview

This skill analyzes design documentation to discover relationships between
documents. It identifies orphaned docs, broken references, cross-module
references, and provides recommendations for improving documentation
connectivity.

## Quick Start

**Full graph:**

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-link/scripts/link.sh" all
```

**Module-specific:**

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-link/scripts/link.sh" effect-type-registry
```

**JSON output:**

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-link/scripts/link.sh" all --format=json
```

**Mermaid diagram:**

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/design-link/scripts/link.sh" all --format=mermaid
```

## Parameters

### Optional

- `module`: Limit to specific module (default: all)
- `format`: Output format (text, json, mermaid) (default: text)

## Workflow

The script performs the graph generation deterministically:

1. **Resolve scope and format** from the positional module argument and
   `--format` flag
2. **Load design.config.json** to identify target modules (falls back to
   listing subdirectories of `.claude/design/`)
3. **Find all design documents** across modules
4. **Parse references** from frontmatter (`related`, `dependencies`) and every
   in-content relative link, whatever its file type — links to source files,
   READMEs and configs are checked, not just links between design docs
5. **Build the graph** with nodes (documents) and edges (references)
6. **Analyze** for orphans, broken references, and bidirectional vs one-way
   pairs
7. **Emit output** in the requested format (text, JSON, or Mermaid)

After running it, **provide recommendations** for improving documentation
connectivity based on the reported orphans and broken links.

The supporting docs below describe the underlying algorithms and output shapes;
they are reference material, not a manual procedure to follow in place of the
script.

## Supporting Documentation

When you need detailed information, load the appropriate supporting file:

### For Detailed Workflow

See [instructions.md](instructions.md) for:

- Complete step-by-step graph generation workflow
- Reference extraction from frontmatter and content
- Graph building algorithm (nodes, edges, validation)
- Analysis algorithms (orphans, cycles, clusters)
- Output generation for each format
- Recommendation strategies
- Advanced features (metrics, subgraphs, impact analysis)

**Load when:** Generating graphs or need implementation details

### For Graph Algorithms

See [graph-algorithms.md](graph-algorithms.md) for:

- Graph structure (nodes, edges)
- Orphan detection algorithm
- Circular dependency detection
- Connected components analysis
- Bidirectional and one-way detection
- Cross-module analysis
- Metrics calculation

**Load when:** Need algorithm details or implementing custom analysis

### For Output Formats

See [output-formats.md](output-formats.md) for:

- Mermaid diagram generation (syntax, styling, legends)
- Text report structure and sections
- JSON schema and format
- Format selection guidelines

**Load when:** Generating output or need format specifications

### For Usage Examples

See [examples.md](examples.md) for:

- Full graph for all modules
- Orphaned docs report
- Dependency graph only
- Module-specific graph
- Cross-module references
- Bidirectional vs one-way analysis
- Error scenarios (no docs, broken references)

**Load when:** User needs examples or clarification

## Error Handling

### No Design Docs Found

```text
INFO: No design documents found in {module}

This is normal for new modules. Run /design-docs:design-init to create your first
design doc.
```

### Broken References

A reference is broken when its target does not exist. This covers frontmatter `related` / `dependencies` entries, in-content links to other design docs, and in-content links that resolve *outside* the design tree — source files, READMEs, configs. That last group matters most: the style guide tells authors to point at real source paths, so a checker that skipped them left the most style-compliant docs the least validated.

Content-link failures carry the source line, and each occurrence is reported separately — the same dead link twice in one doc is two findings, not one.

The renderer emits one global section, not a block per document:

```text
## Broken References

- {doc}:{line} → {resolved-target} (target missing)
- {doc} → {resolved-target} (target missing)        # from frontmatter, no line
```

Fix by correcting the path, creating the missing file, or removing the reference.

The reported target is the path the link *actually resolves to*, not the path as written. A link with too few `../` segments to escape `.claude/` shows up as `.claude/packages/...` — which is the fastest way to see what went wrong.

## Integration

Works well with:

- `/design-docs:design-review` - Review docs flagged as orphaned
- `/design-docs:design-update` - Add missing cross-references
- `/design-docs:design-validate` - Ensure references are valid
- `/design-docs:design-search` - Find related docs to add references

## Success Criteria

A successful link analysis:

- ✅ All design docs discovered
- ✅ All references extracted (frontmatter + content)
- ✅ Graph built correctly
- ✅ Orphans identified
- ✅ Circular dependencies detected
- ✅ Clear visualization generated
- ✅ Actionable recommendations provided
