---
description: Detects the shape and metadata of a repo for user-docs work. Reads package.json, pnpm-workspace.yaml, and packages/ directory; returns kind (single, monorepo-root, monorepo-package), packageName, license, runtime, engineRange, tsVersion, and packageManager. Pure detection, no writes.
user-invocable: false
---

# user-docs-detect-shape

Detect the shape and metadata of the current repo so other user-docs skills and the `user-docs` agent can act correctly. This skill never writes files. It only reads.

## Inputs

`$ARGUMENTS` is an optional path to a directory. If omitted, use the current working directory.

## What to detect

Resolve the target directory (the argument or `.`). From there:

1. **Repo kind:**
   - If `<dir>/package.json` has a `workspaces` field, OR `<dir>/pnpm-workspace.yaml` exists, OR `<dir>/packages/` contains sub-`package.json` files: `monorepo-root`.
   - If the path's parent chain contains a directory that satisfies the monorepo-root condition AND the current `package.json` is a sub-package, return `monorepo-package`. **Sub-package** means the current `package.json` exists under any path matched by the parent's `workspaces` glob (e.g. `packages/*`, `apps/*`) OR by the parent's `pnpm-workspace.yaml` `packages:` glob.
   - Otherwise: `single`.
2. **Package name:** from `package.json` `name` field.
3. **License:** from `package.json` `license` field. SPDX ID expected (`MIT`, `Apache-2.0`, etc.).
4. **Runtime:** look at `engines` in `package.json`:
   - `engines.node` set with a meaningful range → `runtime: "node"`
   - `engines.bun` set with a meaningful range → `runtime: "bun"`
   - `engines.deno` set with a meaningful range → `runtime: "deno"`
   - **No `engines` field at all → `runtime: null`.**
   - **Engine value is `*`, an empty string, `>=0`, or any range that matches every version → treat as null** (the value is meaningless). Do not emit a runtime badge for ranges like `Node.js *`.
   - **Multiple runtimes set:** if `engines.node` AND `engines.bun` (and/or `engines.deno`) are all set with meaningful ranges, return all of them as a list: `runtime: ["node", "bun"]`. Callers will emit one runtime badge per declared runtime in the order: node, bun, deno.
5. **Engine range:** the value of the matched engines field (e.g. `>=20`, `>=22`). If runtime is null, this is null. If runtime is a list, this is a parallel list of ranges in the same order.
6. **TypeScript version:** from `devDependencies.typescript` or `dependencies.typescript`. Strip leading `^`, `~`, `>=` to get the floor (e.g. `^5.6.0` → `5.6`).
7. **Package manager:** from `packageManager` field in `package.json`, or by lockfile detection (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb` → bun, otherwise npm).

## Output format

Report findings as a markdown block in your response, like:

```yaml
kind: single
packageName: std-osc8
license: MIT
runtime: node
engineRange: ">=20"
tsVersion: "5.6"
packageManager: pnpm
```

If a field cannot be detected, set it to `null` and continue. The most common null cases:

- No `engines` field → `runtime: null` and `engineRange: null`. Callers will skip the runtime badge.
- No `typescript` dep → `tsVersion: null`. Callers will skip the TypeScript badge.
- Missing `license` is unusual. If it happens, report `license: null` and let the caller raise it with the user.

Example with missing `engines` and `typescript`:

```yaml
kind: single
packageName: simple-cli
license: MIT
runtime: null
engineRange: null
tsVersion: null
packageManager: npm
```

## Behavior

- Use Read and Glob tools only. No Write, no Edit.
- Never invent values. If a field is genuinely missing, report it as `null` so callers can decide how to proceed.
- Do not run shell commands beyond `ls` for directory probing if needed.
