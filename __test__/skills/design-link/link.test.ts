import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPT_PATH = join(import.meta.dir, "../../../plugin/skills/design-link/scripts/link.sh");

function run(projectDir: string, args: string[] = ["all"]) {
	const proc = Bun.spawnSync(["bash", SCRIPT_PATH, ...args], {
		cwd: projectDir,
		env: { ...process.env, DESIGN_DOCS_PROJECT_DIR: projectDir },
	});
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

describe("design-link link.sh", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "design-link-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	function seedGraph(): void {
		writeFileAt(
			".claude/design/design.config.json",
			JSON.stringify({
				version: "1.0.0",
				modules: { mod: { path: "mod" }, other: { path: "other" } },
				quality: { designDocs: { requireFrontmatter: true } },
			}),
		);
		writeFileAt(
			".claude/design/mod/a.md",
			[
				"---",
				"status: current",
				"completeness: 80",
				"related:",
				"  - b.md",
				"dependencies:",
				"  - ../other/c.md",
				"---",
				"# A",
				"See [missing](./gone.md).",
				"",
			].join("\n"),
		);
		writeFileAt(
			".claude/design/mod/b.md",
			["---", "status: current", "completeness: 70", "related:", "  - a.md", "---", "# B", ""].join("\n"),
		);
		writeFileAt(
			".claude/design/other/c.md",
			["---", "status: draft", "completeness: 40", "related: []", "dependencies: []", "---", "# C", ""].join("\n"),
		);
		writeFileAt(
			".claude/design/mod/orphan.md",
			["---", "status: stub", "completeness: 5", "related: []", "dependencies: []", "---", "# Orphan", ""].join("\n"),
		);
	}

	test("produces a cross-reference graph, never a code review", () => {
		seedGraph();
		const { exitCode, stdout } = run(repo);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("# Design Documentation Cross-Reference Graph");
		// Guard against the reported regression where it analyzed a git commit.
		expect(stdout).not.toMatch(/commit|git diff|dependency range/i);
	});

	test("counts documents, references, broken links, and orphans", () => {
		seedGraph();
		const { stdout } = run(repo);
		expect(stdout).toContain("- Documents: 4");
		expect(stdout).toContain("- Broken references: 1");
		expect(stdout).toContain("- Orphaned documents: 1");
	});

	test("collapses mutual related links into a bidirectional edge", () => {
		seedGraph();
		const { stdout } = run(repo);
		expect(stdout).toContain(".claude/design/mod/a.md ↔ .claude/design/mod/b.md (related)");
	});

	test("resolves cross-module dependency references", () => {
		seedGraph();
		const { stdout } = run(repo);
		expect(stdout).toContain(".claude/design/mod/a.md → .claude/design/other/c.md (dependency)");
	});

	test("flags a broken design-doc link with its intended target", () => {
		seedGraph();
		const { stdout } = run(repo);
		expect(stdout).toContain(".claude/design/mod/gone.md (target missing)");
	});

	test("identifies orphaned documents", () => {
		seedGraph();
		const { stdout } = run(repo);
		expect(stdout).toMatch(/## Orphaned Documents[\s\S]*orphan\.md/);
	});

	test("emits valid JSON for --format=json", () => {
		seedGraph();
		const { stdout } = run(repo, ["all", "--format=json"]);
		const parsed = JSON.parse(stdout) as {
			summary: { documents: number; broken: number; orphaned: number };
			edges: { from: string; to: string; type: string }[];
		};
		expect(parsed.summary.documents).toBe(4);
		expect(parsed.summary.broken).toBe(1);
		expect(parsed.summary.orphaned).toBe(1);
		expect(parsed.edges.length).toBe(3);
	});

	test("emits a mermaid graph for --format=mermaid", () => {
		seedGraph();
		const { stdout } = run(repo, ["all", "--format=mermaid"]);
		expect(stdout).toContain("```mermaid");
		expect(stdout).toContain("graph TD");
	});

	test("scopes to a single module when given a module argument", () => {
		seedGraph();
		const { stdout } = run(repo, ["other"]);
		expect(stdout).toContain("- Documents: 1");
		expect(stdout).toContain(".claude/design/other/c.md");
		expect(stdout).not.toContain(".claude/design/mod/orphan.md");
	});

	test("rejects an unknown format", () => {
		seedGraph();
		const { exitCode, stderr } = run(repo, ["all", "--format=bogus"]);
		expect(exitCode).toBe(2);
		expect(stderr).toContain("unknown format");
	});

	test("reports cleanly when there are no design docs", () => {
		writeFileAt(
			".claude/design/design.config.json",
			JSON.stringify({ version: "1.0.0", modules: {}, quality: { designDocs: { requireFrontmatter: true } } }),
		);
		const { exitCode, stdout } = run(repo);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("- Documents: 0");
		expect(stdout).toContain("_No design documents found._");
	});
});
