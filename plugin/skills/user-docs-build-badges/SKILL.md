---
description: Emits the standard 4-badge markdown block for a package README using brand colors. Takes detected metadata (package name, license SPDX, runtime, engine range, TypeScript version) and outputs npm version, license, runtime, and TypeScript badges with consistent shields.io URLs. Source of truth for badge URL format.
user-invocable: false
---

# user-docs-build-badges

Emit the canonical 4-badge block for a package README. The package name is the source of truth for the npm badge URL — never copy a name from existing badge text, since that is how `npm/v/wrong-package` bugs creep in.

## Inputs

Caller passes (typically as YAML or a structured prompt):

- `packageName` — required. Use the exact `name` field from `package.json`. URL-encode the `/` in scoped names (`@scope/pkg` → `@scope%2Fpkg`); leave the `@` bare.
- `license` — required. SPDX ID like `MIT`, `Apache-2.0`, `BSD-3-Clause`.
- `runtime` — optional. One of `node`, `bun`, `deno`, OR a list (e.g. `["node", "bun"]`) when the package declares multiple runtimes. If `null` (no `engines` field, OR `engines` value is `*`/`>=0`/empty), the runtime badge is skipped.
- `engineRange` — required if `runtime` is set. The version range from `engines.<runtime>` (e.g. `>=20`, `>=22`). URL-encode `>` as `%3E` and spaces as `%20`. If `null`, the runtime badge is skipped. If `runtime` is a list, this is a parallel list of ranges in the same order.

**Multi-runtime packages:** If `runtime` is a list, emit one runtime badge per declared runtime in this order: node, bun, deno. The badges all sit between the License badge and the TypeScript badge.

- `tsVersion` — optional. Floor version like `5.6` (strip `^`, `~`). If `null` (no `typescript` dep found), the TypeScript badge is skipped.

## Skipping rules

Never invent values. The block may have 2, 3, or 4 standard badges depending on what metadata was available:

- `runtime` is null OR `engineRange` is null → omit the runtime badge.
- `tsVersion` is null → omit the TypeScript badge.
- npm and License are always emitted (those fields are always present in any publishable `package.json`).

If the caller is normalizing an existing block that has a runtime or TypeScript badge, but detection now returns null for that field, report that skip clearly so the caller can decide whether to ask the user for explicit values rather than silently dropping the badge.

## Output

Emit the standard badges, in this exact order, formatted as a single markdown block (omit lines for skipped badges):

```markdown
[![npm](https://img.shields.io/npm/v/<encoded-name>?label=npm&color=cb3837)](https://www.npmjs.com/package/<name>)
[![License: <license>](https://img.shields.io/badge/License-<license>-4caf50.svg)](https://opensource.org/licenses/<license>)
[![<runtime-label> <engineRange>](<runtime-badge-url>)](<runtime-link>)
[![TypeScript <tsVersion>](https://img.shields.io/badge/TypeScript-<tsVersion>-3178c6.svg)](https://www.typescriptlang.org/)
```

## Runtime badge details

Node.js: label "Node.js", color `5fa04e` (default label/white text), link `https://nodejs.org/`

Bun: label "Bun", color `f9f1e1`, dark text via `?style=flat&logo=bun&logoColor=000000`, link `https://bun.sh/`

Deno: label "Deno", color `000000` (white text on black), link `https://deno.com/`

For `node`:

```url
https://img.shields.io/badge/Node.js-<encoded-engineRange>-5fa04e.svg
```

For `bun`:

```url
https://img.shields.io/badge/Bun-<encoded-engineRange>-f9f1e1.svg?logo=bun&logoColor=000000
```

For `deno`:

```url
https://img.shields.io/badge/Deno-<encoded-engineRange>-000000.svg
```

## License color

For `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `Unlicense`: use `4caf50` (green).
For copyleft (`GPL-3.0`, `AGPL-3.0`, `LGPL-3.0`): use `f57c00` (amber, signals attention).
For `UNLICENSED` or proprietary: use `9e9e9e` (grey).

## URL encoding rules

- `@scope/pkg` → `@scope%2Fpkg` in shields.io path segments
- `>=20` → `%3E%3D20`
- Whitespace in version ranges → `%20`
- Do NOT encode the `@` in `@scope/pkg` (shields.io accepts it bare)

## Output behavior

Output the markdown block alone, with no surrounding prose. The caller decides where to place it in the README.

## Identifying standard vs custom badges (when normalizing existing READMEs)

Callers preserving custom badges (CI status, codecov, downloads, social, sponsorship) need a way to tell standard from custom in an existing block. A badge counts as standard ONLY when both the URL pattern AND the link target match:

| Standard badge | URL pattern (must match) | Link target (must match) |
| -------------- | ------------------------ | ------------------------ |
| npm | `/npm/v/` | `npmjs.com/package/...` |
| License | `/badge/License-` | `opensource.org/licenses/...` |
| Runtime (Node) | `/badge/Node.js-` | `nodejs.org` |
| Runtime (Bun) | `/badge/Bun-` | `bun.sh` |
| Runtime (Deno) | `/badge/Deno-` | `deno.com` |
| TypeScript | `/badge/TypeScript-` | `typescriptlang.org` |

Both checks are required. A custom badge labeled "Node.js Compatibility" pointing at a project README is not the standard runtime badge — leave it alone. A "TypeScript strict" config badge pointing at a custom config doc is not the standard TypeScript badge.

## Custom badge ordering

When normalizing a block:

- Standard badges always appear first, in canonical order (npm, License, Runtime[s], TypeScript).
- Custom badges always appear after, in the order they originally appeared.
- Never reorder custom badges relative to each other. Never add new custom badges that were not present before.

## Examples

For `{ packageName: "std-osc8", license: "MIT", runtime: "node", engineRange: ">=20", tsVersion: "5.6" }`:

```markdown
[![npm](https://img.shields.io/npm/v/std-osc8?label=npm&color=cb3837)](https://www.npmjs.com/package/std-osc8)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D20](https://img.shields.io/badge/Node.js-%3E%3D20-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 5.6](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg)](https://www.typescriptlang.org/)
```

For `{ packageName: "@savvy-web/silk-effects", license: "MIT", runtime: "node", engineRange: ">=22", tsVersion: "5.6" }`:

```markdown
[![npm](https://img.shields.io/npm/v/@savvy-web%2Fsilk-effects?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/silk-effects)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D22](https://img.shields.io/badge/Node.js-%3E%3D22-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 5.6](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg)](https://www.typescriptlang.org/)
```
