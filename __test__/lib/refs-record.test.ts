import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPT_PATH = join(import.meta.dir, "../../plugin/lib/refs-record.sh");

function run(cwd: string, args: string[]) {
	const proc = Bun.spawnSync(["bash", SCRIPT_PATH, ...args], { cwd });
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

describe("refs-record.sh", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "refs-record-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	function doc(title: string, body: string): string {
		return `---\nstatus: current\nupdated: 2026-01-01\n---\n\n# ${title}\n\n${body}\n`;
	}

	interface RefEntry {
		source: string;
		target: string;
		hash: string;
		recordedAt: string;
	}
	interface RefsManifest {
		version: number;
		refs: RefEntry[];
	}

	function readRefs(): RefsManifest {
		return JSON.parse(readFileSync(join(repo, ".claude/design/refs.json"), "utf8")) as RefsManifest;
	}

	function only(refs: RefsManifest): RefEntry {
		expect(refs.refs).toHaveLength(1);
		const [entry] = refs.refs;
		if (!entry) throw new Error("expected exactly one ref entry");
		return entry;
	}

	test("records a single root pointer with a repo-root-relative target", () => {
		writeFileAt(".claude/design/mod/a.md", doc("A", "Alpha body."));
		writeFileAt("CLAUDE.md", "See `@./.claude/design/mod/a.md` for details.\n");

		const { exitCode } = run(repo, ["CLAUDE.md"]);
		expect(exitCode).toBe(0);

		const entry = only(readRefs());
		expect(entry.source).toBe("CLAUDE.md");
		expect(entry.target).toBe(".claude/design/mod/a.md");
		expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
		expect(entry.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	test("records multiple pointers sorted by target", () => {
		writeFileAt(".claude/design/mod/a.md", doc("A", "Alpha."));
		writeFileAt(".claude/design/mod/b.md", doc("B", "Bravo."));
		writeFileAt("CLAUDE.md", "@./.claude/design/mod/b.md and @./.claude/design/mod/a.md\n");

		run(repo, ["CLAUDE.md"]);
		const refs = readRefs();
		expect(refs.refs.map((r) => r.target)).toEqual([".claude/design/mod/a.md", ".claude/design/mod/b.md"]);
	});

	test("resolves a child CLAUDE.md @../ pointer to repo-root-relative", () => {
		writeFileAt(".claude/design/mod/a.md", doc("A", "Alpha."));
		writeFileAt("pkg/CLAUDE.md", "@../.claude/design/mod/a.md\n");

		run(repo, ["pkg/CLAUDE.md"]);
		const entry = only(readRefs());
		expect(entry.source).toBe("pkg/CLAUDE.md");
		expect(entry.target).toBe(".claude/design/mod/a.md");
	});

	test("creates refs.json when it does not exist", () => {
		writeFileAt(".claude/design/mod/a.md", doc("A", "Alpha."));
		writeFileAt("CLAUDE.md", "@./.claude/design/mod/a.md\n");
		// No pre-existing refs.json.
		const { exitCode } = run(repo, ["CLAUDE.md"]);
		expect(exitCode).toBe(0);
		expect(readRefs().version).toBe(1);
	});

	test("replaces this source's entries but preserves other sources", () => {
		writeFileAt(".claude/design/mod/a.md", doc("A", "Alpha."));
		writeFileAt(
			".claude/design/refs.json",
			JSON.stringify({
				version: 1,
				refs: [
					{ source: "other/CLAUDE.md", target: ".claude/design/mod/z.md", hash: "deadbeef", recordedAt: "2025-01-01" },
					{ source: "CLAUDE.md", target: ".claude/design/mod/stale.md", hash: "0000", recordedAt: "2025-01-01" },
				],
			}),
		);
		writeFileAt("CLAUDE.md", "@./.claude/design/mod/a.md\n");

		run(repo, ["CLAUDE.md"]);
		const refs = readRefs();
		// other/CLAUDE.md entry preserved; CLAUDE.md's stale entry replaced with the live one.
		const sources = refs.refs.map((r) => `${r.source}=>${r.target}`);
		expect(sources).toContain("other/CLAUDE.md=>.claude/design/mod/z.md");
		expect(sources).toContain("CLAUDE.md=>.claude/design/mod/a.md");
		expect(sources).not.toContain("CLAUDE.md=>.claude/design/mod/stale.md");
	});

	test("drops a source's entries when it has no pointers", () => {
		writeFileAt(
			".claude/design/refs.json",
			JSON.stringify({
				version: 1,
				refs: [{ source: "CLAUDE.md", target: ".claude/design/mod/gone.md", hash: "0000", recordedAt: "2025-01-01" }],
			}),
		);
		writeFileAt("CLAUDE.md", "No pointers here anymore.\n");

		run(repo, ["CLAUDE.md"]);
		expect(readRefs().refs).toHaveLength(0);
	});

	test("is idempotent across repeated runs", () => {
		writeFileAt(".claude/design/mod/a.md", doc("A", "Alpha."));
		writeFileAt("CLAUDE.md", "@./.claude/design/mod/a.md\n");
		run(repo, ["CLAUDE.md"]);
		const first = readFileSync(join(repo, ".claude/design/refs.json"), "utf8");
		run(repo, ["CLAUDE.md"]);
		const second = readFileSync(join(repo, ".claude/design/refs.json"), "utf8");
		expect(second).toBe(first);
	});

	test("exits 1 when the source file is missing", () => {
		const { exitCode, stderr } = run(repo, ["nope/CLAUDE.md"]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("source not found");
	});

	test("exits 2 on wrong argument count", () => {
		const { exitCode, stderr } = run(repo, []);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("usage");
	});
});
