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

describe("design-link out-of-tree reference checking", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "design-link-outside-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	function config(): string {
		return JSON.stringify({
			version: "1.0.0",
			modules: { mod: { path: "mod" } },
			quality: { designDocs: { requireFrontmatter: true } },
		});
	}

	function docWithBody(body: string[]): string {
		return ["---", "status: current", "completeness: 80", "related: []", "---", "# A", "", ...body, ""].join("\n");
	}

	test("flags a broken link to a source file outside the design tree", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [build](../../../src/missing.ts)."]));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 1");
		expect(stdout).toContain("src/missing.ts (target missing)");
	});

	test("does not flag a link to a source file that exists", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt("src/index.ts", "export const a = 1;\n");
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [entry](../../../src/index.ts)."]));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 0");
	});

	test("treats a link to an existing directory as present, and keeps classifying later refs", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt("src/thing/f.txt", "x\n");
		writeFileAt(
			".claude/design/mod/a.md",
			docWithBody([
				"See [thing](../../../src/thing).",
				"Also [real](../../../src/thing/f.txt) and [dead](../../../src/nope.txt).",
			]),
		);

		const { stdout, stderr } = run(repo);
		// The directory target exists, so only the genuinely dead link counts.
		expect(stdout).toContain("- Broken references: 1");
		expect(stdout).toContain("src/nope.txt (target missing)");
		expect(stdout).not.toContain("src/thing (target missing)");
		// Probing a directory with awk's getline is fatal under the BWK awk on
		// macOS: it aborted the run mid-stream, dropping every later reference
		// while still exiting 0. A silent partial run must not recur.
		expect(stderr).not.toContain("i/o error");
	});

	test("flags a broken README link that under-escapes the .claude directory", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt("packages/pkg/README.md", "# Pkg\n");
		// Three `../` from mod/ lands in .claude/packages/... — one level short.
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [README](../../packages/pkg/README.md)."]));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 1");
		expect(stdout).toContain(".claude/packages/pkg/README.md (target missing)");
	});

	test("does not flag http(s) links", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [docs](https://example.com/x.ts)."]));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 0");
	});

	test("reports each occurrence of a repeated broken link, not just the first", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(
			".claude/design/mod/a.md",
			docWithBody(["First [gone](./gone.md).", "", "Later, again [gone](./gone.md)."]),
		);

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 2");
	});

	test("includes the source line number for a broken content link", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [gone](./gone.md)."]));

		const { stdout } = run(repo, ["all", "--format=json"]);
		const parsed = JSON.parse(stdout) as { broken: { from: string; to: string; line: number }[] };
		expect(parsed.broken).toHaveLength(1);
		expect(parsed.broken[0]?.line).toBe(8);
	});
});

describe("design-link markdown destination parsing", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "design-link-dest-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	function config(): string {
		return JSON.stringify({
			version: "1.0.0",
			modules: { mod: { path: "mod" } },
			quality: { designDocs: { requireFrontmatter: true } },
		});
	}

	function docWithBody(body: string[]): string {
		return ["---", "status: current", "completeness: 80", "related: []", "---", "# A", "", ...body, ""].join("\n");
	}

	// A checker that invents broken links is worse than one that misses them.
	test("strips a link title and does not invent a broken reference", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt("src/index.ts", "export const a = 1;\n");
		writeFileAt(".claude/design/mod/a.md", docWithBody(['See [entry](../../../src/index.ts "The entry point").']));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 0");
	});

	test("strips a single-quoted link title", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt("src/index.ts", "export const a = 1;\n");
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [entry](../../../src/index.ts 'entry')."]));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 0");
	});

	test("treats an angle-bracket-wrapped URL as external, not a relative path", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [site](<https://example.com/x>)."]));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 0");
	});

	test("unwraps an angle-bracket relative destination", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt("src/weird name.ts", "export const a = 1;\n");
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [w](<../../../src/weird name.ts>)."]));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 0");
	});

	test("preserves balanced parentheses inside a destination", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt("src/foo(bar).ts", "export const a = 1;\n");
		writeFileAt(".claude/design/mod/a.md", docWithBody(["See [p](../../../src/foo(bar).ts)."]));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 0");
	});

	test("still flags a genuinely missing target that carries a title", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWithBody(['See [gone](../../../src/gone.ts "Missing").']));

		const { stdout } = run(repo);
		expect(stdout).toContain("- Broken references: 1");
		expect(stdout).toContain("src/gone.ts (target missing)");
	});
});

describe("design-link JSON escaping", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "design-link-json-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	// A path containing `"` used to be interpolated straight into a JSON string
	// template, producing an invalid document that jq rejected -- which the
	// `|| true` guard then silently turned into an empty list.
	test("emits valid JSON when a broken target contains a double quote", () => {
		writeFileAt(
			".claude/design/design.config.json",
			JSON.stringify({
				version: "1.0.0",
				modules: { mod: { path: "mod" } },
				quality: { designDocs: { requireFrontmatter: true } },
			}),
		);
		writeFileAt(
			".claude/design/mod/a.md",
			["---", "status: current", "completeness: 80", "related: []", "---", "# A", "", 'See [q](./we"ird.md).', ""].join(
				"\n",
			),
		);

		const { stdout } = run(repo, ["all", "--format=json"]);
		const parsed = JSON.parse(stdout) as { broken: { to: string }[]; summary: { broken: number } };
		expect(parsed.summary.broken).toBe(1);
		expect(parsed.broken[0]?.to).toContain('we"ird.md');
	});
});
