import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT_PATH = join(import.meta.dir, "../../plugin/lib/ref-hash.sh");

function runHash(args: string[]) {
	const proc = Bun.spawnSync(["bash", SCRIPT_PATH, ...args]);
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

describe("ref-hash.sh", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "ref-hash-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	function write(name: string, content: string): string {
		const path = join(dir, name);
		writeFileSync(path, content);
		return path;
	}

	test("emits a lowercase hex sha256 with no trailing newline", () => {
		const path = write("a.md", "---\nupdated: 2026-01-01\n---\n\n# Title\n\nBody.\n");
		const { exitCode, stdout } = runHash([path]);
		expect(exitCode).toBe(0);
		expect(stdout).toMatch(/^[0-9a-f]{64}$/);
	});

	test("ignores frontmatter changes (timestamp bumps do not move the hash)", () => {
		const v1 = write("v1.md", "---\nupdated: 2026-01-01\nlast-synced: 2026-01-01\n---\n\n# Title\n\nSame body.\n");
		const v2 = write("v2.md", "---\nupdated: 2026-06-05\nlast-synced: 2026-06-05\n---\n\n# Title\n\nSame body.\n");
		expect(runHash([v1]).stdout).toBe(runHash([v2]).stdout);
	});

	test("changes when the body content changes", () => {
		const a = write("a.md", "---\nupdated: 2026-01-01\n---\n\n# Title\n\nOriginal body.\n");
		const b = write("b.md", "---\nupdated: 2026-01-01\n---\n\n# Title\n\nEdited body.\n");
		expect(runHash([a]).stdout).not.toBe(runHash([b]).stdout);
	});

	test("hashes the whole file when there is no frontmatter", () => {
		const withFm = write("with.md", "---\nupdated: 2026-01-01\n---\n# Title\n\nBody.\n");
		const noFm = write("without.md", "# Title\n\nBody.\n");
		// Body after frontmatter stripping is identical, so hashes match.
		expect(runHash([withFm]).stdout).toBe(runHash([noFm]).stdout);
	});

	test("exits 1 when the file does not exist", () => {
		const { exitCode, stderr } = runHash([join(dir, "missing.md")]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("file not found");
	});

	test("exits 1 on unterminated frontmatter instead of hashing the empty string", () => {
		// Opening `---` with no closing fence would otherwise swallow the body.
		const path = write("bad.md", "---\nstatus: current\nno closing fence here\n");
		const { exitCode, stderr } = runHash([path]);
		expect(exitCode).toBe(1);
		expect(stderr).toContain("unterminated");
	});

	test("exits 2 when no argument is given", () => {
		const { exitCode, stderr } = runHash([]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("usage");
	});

	describe("--record mode", () => {
		test("emits a full refs.json entry stamped with today's date", () => {
			const target = write("doc.md", "---\nupdated: 2026-01-01\n---\n\n# Title\n\nBody.\n");
			const { exitCode, stdout } = runHash(["--record", "CLAUDE.md", target]);
			expect(exitCode).toBe(0);
			const entry = JSON.parse(stdout);
			expect(entry.source).toBe("CLAUDE.md");
			expect(entry.target).toBe(target);
			expect(entry.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			// The recorded hash equals the plain-mode hash of the same target.
			expect(entry.hash).toBe(runHash([target]).stdout);
		});

		test("exits 2 when --record is missing source/target", () => {
			const { exitCode, stderr } = runHash(["--record", "CLAUDE.md"]);
			expect(exitCode).toBe(2);
			expect(stderr).toContain("usage");
		});
	});
});
