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

	function seedAnchorGraph(): void {
		writeFileAt(
			".claude/design/design.config.json",
			JSON.stringify({
				version: "1.0.0",
				modules: { anchors: { path: "anchors" } },
				quality: { designDocs: { requireFrontmatter: true } },
			}),
		);
		writeFileAt(
			".claude/design/anchors/self.md",
			[
				"---",
				"status: current",
				"completeness: 90",
				"related: []",
				"dependencies: []",
				"---",
				"# Self",
				"",
				"## Setup",
				"",
				"See the [setup section](#setup) for details.",
				"",
				"Broken: [nowhere](#does-not-exist).",
				"",
			].join("\n"),
		);
		writeFileAt(
			".claude/design/anchors/target.md",
			[
				"---",
				"status: current",
				"completeness: 90",
				"related: []",
				"dependencies: []",
				"---",
				"# Target",
				"",
				"## Consumer Seam",
				"",
				"## Resolution belongs to @effected/npm",
				"",
				"## Use `foo()` correctly",
				"",
				"## Setup",
				"",
				"## Setup",
				"",
			].join("\n"),
		);
		writeFileAt(
			".claude/design/anchors/linker.md",
			[
				"---",
				"status: current",
				"completeness: 90",
				"related: []",
				"dependencies: []",
				"---",
				"# Linker",
				"",
				"Valid: [consumer seam](./target.md#consumer-seam).",
				"",
				"Broken: [nope](./target.md#does-not-exist-either).",
				"",
				"Glyph: [glyph heading](./target.md#resolution-belongs-to-effectednpm).",
				"",
				"Backtick: [code heading](./target.md#use-foo-correctly).",
				"",
				"Dup: [second setup](./target.md#setup-1).",
				"",
			].join("\n"),
		);
	}

	test("resolves a valid same-file anchor link", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors"]);
		expect(stdout).not.toMatch(/anchors\/self\.md → #setup \(anchor missing\)/);
	});

	test("flags a broken same-file anchor link", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors"]);
		expect(stdout).toContain(".claude/design/anchors/self.md → #does-not-exist (anchor missing)");
	});

	test("resolves a valid cross-file anchor link", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors"]);
		expect(stdout).not.toMatch(/target\.md#consumer-seam \(anchor missing\)/);
	});

	test("flags a broken cross-file anchor link", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors"]);
		expect(stdout).toContain(
			".claude/design/anchors/linker.md → .claude/design/anchors/target.md#does-not-exist-either (anchor missing)",
		);
	});

	test("resolves a duplicate heading via the -1 suffix", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors"]);
		expect(stdout).not.toMatch(/target\.md#setup-1 \(anchor missing\)/);
	});

	test("resolves a heading slug with punctuation and an @ glyph", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors"]);
		expect(stdout).not.toMatch(/target\.md#resolution-belongs-to-effectednpm \(anchor missing\)/);
	});

	test("resolves a heading slug from text containing backticks", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors"]);
		expect(stdout).not.toMatch(/target\.md#use-foo-correctly \(anchor missing\)/);
	});

	test("counts broken anchors in the summary", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors"]);
		expect(stdout).toContain("- Broken anchors: 2");
	});

	test("includes brokenAnchors in JSON output", () => {
		seedAnchorGraph();
		const { stdout } = run(repo, ["anchors", "--format=json"]);
		const parsed = JSON.parse(stdout) as {
			summary: { brokenAnchors: number };
			brokenAnchors: { from: string; to: string; anchor: string }[];
		};
		expect(parsed.summary.brokenAnchors).toBe(2);
		expect(parsed.brokenAnchors.length).toBe(2);
	});

	function seedSubdirGraph(): void {
		writeFileAt(
			".claude/design/design.config.json",
			JSON.stringify({
				version: "1.0.0",
				modules: { mod: { path: "mod" } },
				quality: { designDocs: { requireFrontmatter: true } },
			}),
		);
		writeFileAt(
			".claude/design/mod/index.md",
			[
				"---",
				"status: current",
				"completeness: 80",
				"related: []",
				"dependencies: []",
				"---",
				"# Index",
				"",
				"See [toml](./packages/toml.md) and [its factories](./packages/toml.md#api-extractor--effect-class-factories).",
				"",
			].join("\n"),
		);
		writeFileAt(
			".claude/design/mod/packages/toml.md",
			[
				"---",
				"status: current",
				"completeness: 70",
				"related:",
				"  - ../index.md",
				"dependencies: []",
				"---",
				"# Toml",
				"",
				"## API Extractor × Effect class factories",
				"",
			].join("\n"),
		);
		writeFileAt(
			".claude/design/mod/_archive/old.md",
			["---", "status: archived", "completeness: 100", "related: []", "dependencies: []", "---", "# Old", ""].join(
				"\n",
			),
		);
	}

	test("discovers docs in module subdirectories as graph nodes", () => {
		seedSubdirGraph();
		const { stdout } = run(repo, ["mod"]);
		expect(stdout).toContain("- Documents: 2");
		expect(stdout).toContain(".claude/design/mod/packages/toml.md");
	});

	test("resolves links into module subdirectories instead of reporting the target missing", () => {
		seedSubdirGraph();
		const { stdout } = run(repo, ["mod"]);
		expect(stdout).toContain("- Broken references: 0");
		expect(stdout).toContain(".claude/design/mod/index.md → .claude/design/mod/packages/toml.md (content-link)");
	});

	test("resolves frontmatter references from a subdirectory doc back to its parent", () => {
		seedSubdirGraph();
		const { stdout } = run(repo, ["mod"]);
		expect(stdout).toContain(".claude/design/mod/packages/toml.md ↔ .claude/design/mod/index.md (related)");
	});

	test("excludes _archive docs from discovery", () => {
		seedSubdirGraph();
		const { stdout } = run(repo, ["mod"]);
		expect(stdout).not.toContain("_archive/old.md");
	});

	test("preserves consecutive hyphens in heading slugs like GitHub does", () => {
		seedSubdirGraph();
		const { stdout } = run(repo, ["mod"]);
		expect(stdout).not.toMatch(/toml\.md#api-extractor--effect-class-factories \(anchor missing\)/);
		expect(stdout).toContain("- Broken anchors: 0");
	});
});
