---
"design-docs-plugin": minor
---

## Features

### Design Documentation Management System

A Claude Code plugin that brings structured design documentation, CLAUDE.md context management, implementation planning, and user-facing documentation generation into any project. Injects session context automatically and provides 34 skills across 4 categories plus 3 specialized agents.

**Skills:**

* **design-\* (15 skills)** — Full lifecycle management for internal design documents: initialize from templates, validate structure and frontmatter, update content, sync with codebase changes, review for quality, audit health, search across docs, compare versions, link cross-references, generate indexes and reports, export to other formats, archive outdated docs, prune historical cruft, and manage system configuration
* **context-\* (5 skills)** — Maintain CLAUDE.md context files that provide LLM assistants with project understanding: validate structure and formatting, audit quality and token efficiency, review for improvements, update based on codebase changes, and split oversized files into focused children
* **docs-\* (9 skills)** — Generate user-facing documentation from design docs and source code: create and update README files, repository documentation, documentation sites, CONTRIBUTING.md, and SECURITY.md, plus review documentation quality, audit package.json completeness, sync docs with code changes, and run comprehensive pre-merge documentation checks
* **plan-\* (5 skills)** — Create and track implementation plans as transitory documents that bridge design docs and active development: create plans from templates, validate structure, list and filter by status or module, explore plan relationships and health, and complete plans by persisting knowledge back to design docs

**Agents:**

* **design-doc-agent** — Orchestrates multi-skill workflows for design documentation and implementation plan management, with access to all design-\* and plan-\* skills
* **context-doc-agent** — Maintains CLAUDE.md context files across a project using all context-\* skills, ensuring accuracy, efficiency, and proper separation from design docs
* **docs-gen-agent** — Drives end-to-end user documentation generation from design docs and source code using all docs-\* skills

**SessionStart Context Hook:**

Automatically injects a design documentation system overview into every Claude Code session, listing all available skills and agents. Configurable via `DESIGN_DOCS_CONTEXT_ENABLED` environment variable (default: enabled).
