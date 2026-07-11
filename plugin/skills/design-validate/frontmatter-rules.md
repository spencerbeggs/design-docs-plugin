# Design Doc Frontmatter Validation Rules

Complete reference for validating design document frontmatter fields and
values.

## Frontmatter Field Rules

| Field | Type | Required | Validation |
| :---- | :--- | :------- | :--------- |
| status | string | Yes | One of: stub, draft, current, needs-review, archived |
| module | string | Yes | Must exist in config |
| category | string | Yes | Must be in module's categories |
| created | string | Yes | YYYY-MM-DD format |
| updated | string | Yes | YYYY-MM-DD format, >= created |
| last-synced | string | Yes | "never" or YYYY-MM-DD, >= updated |
| completeness | number | Yes | Integer 0-100 |
| related | array | Yes | Array of paths (can be empty) |
| dependencies | array | No | Array of paths; omit entirely when the doc has none |

## Status-Completeness Matrix

| Completeness | Expected Status |
| :----------- | :-------------- |
| 0-20 | stub |
| 21-60 | draft |
| 61-90 | draft (pre-implementation), current, needs-review |
| 91-100 | current |

A `draft` at 61-90% is valid for pre-implementation designs (design fleshed out, code not yet written) and must not trigger a promote-to-current suggestion; `current` asserts the doc reflects implemented code.

`dependencies` is optional. Docs authored outside the templates rarely carry it, and erroring on every one of them made the validator permanently red for a reason no author could act on — which only taught readers to ignore the real findings alongside it. When present it is validated like `related`; when absent it is not reported at all. Templates still scaffold it because declaring dependencies is worth doing, not because a doc is invalid without it.

## Required Sections

Minimum sections (from config):

- Overview
- Current State
- Rationale
- Related Documentation

Category-specific sections:

- **Architecture**: System Architecture, Data Flow, Integration Points
- **Performance**: Performance Characteristics, Optimization Strategies,
  Benchmarks
- **Observability**: Event System, Logging Strategy, Metrics Collection
