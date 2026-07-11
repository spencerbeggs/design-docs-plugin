import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Every shipped shell script must run under bash 3.2: skills invoke scripts as
// literal `bash script.sh`, which on a stock Mac resolves to /bin/bash 3.2
// (Apple froze it there over GPLv3), bypassing the #!/usr/bin/env bash shebang.
// This test statically rejects bash >= 4 constructs in everything under plugin/.

const PLUGIN_DIR = join(import.meta.dir, "../../plugin");

interface Bash4ism {
	name: string;
	pattern: RegExp;
}

const BASH4ISMS: Bash4ism[] = [
	{ name: "mapfile builtin", pattern: /(^|[;&|]\s*|\s)mapfile(\s|$)/ },
	{ name: "readarray builtin", pattern: /(^|[;&|]\s*|\s)readarray(\s|$)/ },
	{ name: "associative array (declare -A)", pattern: /declare\s+-[a-zA-Z]*A/ },
	{ name: "lowercase case-modification expansion (,,)", pattern: /\$\{[A-Za-z_][A-Za-z0-9_]*,,/ },
	{ name: "uppercase case-modification expansion (^^)", pattern: /\$\{[A-Za-z_][A-Za-z0-9_]*\^\^/ },
	{ name: "negative array index [-1]", pattern: /\$\{[A-Za-z_][A-Za-z0-9_]*\[-\d+\]\}/ },
	{ name: "&>> redirection", pattern: /&>>/ },
];

function shippedScripts(): string[] {
	const glob = new Bun.Glob("**/*.sh");
	return [...glob.scanSync({ cwd: PLUGIN_DIR })].sort();
}

describe("bash 3.2 portability of shipped scripts", () => {
	const scripts = shippedScripts();

	test("finds the shipped scripts", () => {
		expect(scripts.length).toBeGreaterThan(5);
	});

	for (const script of scripts) {
		test(`${script} avoids bash 4+ constructs`, () => {
			const lines = readFileSync(join(PLUGIN_DIR, script), "utf8").split("\n");
			const hits: string[] = [];
			lines.forEach((line, i) => {
				const code = line.replace(/(^|\s)#.*$/, ""); // strip comments
				for (const { name, pattern } of BASH4ISMS) {
					if (pattern.test(code)) {
						hits.push(`${script}:${i + 1} ${name}: ${line.trim()}`);
					}
				}
			});
			expect(hits).toEqual([]);
		});
	}

	// The shipped scripts also embed awk programs, and `awk` is mawk on Debian /
	// Ubuntu. `\x` hex escapes are an awk extension mawk need not honor, so a
	// regex relying on one can silently fail to match there — which for the link
	// checker means a title stays glued to the path and reports as a broken link.
	// POSIX octal (\047) is the portable spelling.
	//
	// Bash's own ANSI-C quoting ($'\x1e') is a different construct and is fine on
	// bash 3.2, so those segments are stripped before the check rather than
	// flagged.
	//
	// ANSI-C strings are stripped BEFORE comments, not after. A `#` can appear
	// inside a $'...' string, and stripping comments first would truncate the
	// line at it -- discarding any real `\x` escape that followed and letting it
	// through unflagged. A guard that fails open is worse than no guard.
	//
	// The character class excludes `\` so the alternation is unambiguous: a
	// backslash can only match `\\.`, never the negated class. The ambiguous
	// form is the classic backtracking shape CodeQL flags.
	for (const script of scripts) {
		test(`${script} avoids non-POSIX awk hex escapes`, () => {
			const lines = readFileSync(join(PLUGIN_DIR, script), "utf8").split("\n");
			const hits: string[] = [];
			lines.forEach((line, i) => {
				const code = line
					.replace(/\$'(?:\\.|[^'\\])*'/g, "") // strip bash ANSI-C quoting
					.replace(/(^|\s)#.*$/, ""); // strip comments
				// awk accepts one OR two hex digits after \x, so `\x1` is just as
				// non-POSIX as `\x1e`.
				if (/\\x[0-9a-fA-F]{1,2}/.test(code)) {
					hits.push(`${script}:${i + 1} non-POSIX awk hex escape: ${line.trim()}`);
				}
			});
			expect(hits).toEqual([]);
		});
	}

	for (const script of scripts) {
		test(`${script} parses under /bin/bash 3.2 when available`, () => {
			// bash -n catches syntax-level incompatibilities the regexes miss.
			// /bin/bash is bash 3.2 on macOS; on Linux runners it is modern
			// bash, where -n still validates basic syntax.
			const proc = Bun.spawnSync(["/bin/bash", "-n", join(PLUGIN_DIR, script)]);
			expect(proc.exitCode).toBe(0);
		});
	}
});
