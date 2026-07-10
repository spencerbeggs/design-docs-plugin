import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SCRIPT_PATH = join(import.meta.dir, "../../../plugin/skills/design-validate/scripts/validate.sh");

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

describe("validate.sh recommended-section warnings", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "validate-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	function config(minSections?: string[]): string {
		const designDocs: Record<string, unknown> = { requireFrontmatter: true, requireTOC: true };
		if (minSections) designDocs.minSections = minSections;
		return JSON.stringify({
			version: "1.0.0",
			modules: { mod: { path: "mod", designDocsPath: ".claude/design/mod", categories: ["architecture"] } },
			quality: { designDocs },
		});
	}

	// A doc carrying an Overview heading but neither Current State nor Rationale.
	function overviewOnlyDoc(): string {
		return [
			"---",
			"status: current",
			"module: mod",
			"category: architecture",
			"created: 2026-01-01",
			"updated: 2026-01-01",
			"last-synced: 2026-01-01",
			"completeness: 80",
			"related: []",
			"dependencies: []",
			"---",
			"",
			"## Overview",
			"",
			"Body.",
			"",
		].join("\n");
	}

	test("honors configured minSections and does not warn about unconfigured sections", () => {
		writeFileAt(".claude/design/design.config.json", config(["Overview"]));
		writeFileAt(".claude/design/mod/a.md", overviewOnlyDoc());

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Missing recommended section 'Current State'");
		expect(stdout).not.toContain("Missing recommended section 'Rationale'");
		expect(stdout).not.toContain("Missing recommended section 'Overview'");
	});

	test("does not warn when design.config.json exists but defines no section requirements", () => {
		// The project opted into a config file without declaring minSections at
		// all -- that's an explicit "we don't require recommended sections"
		// signal, not an invitation to fall back to the hardcoded default list.
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", overviewOnlyDoc());

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Missing recommended section");
	});

	test("treats an empty minSections array as 'no required sections'", () => {
		writeFileAt(".claude/design/design.config.json", config([]));
		writeFileAt(".claude/design/mod/a.md", overviewOnlyDoc());

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Missing recommended section");
	});

	test("falls back to the default section list only when no design.config.json exists at all", () => {
		// No config file written at all -- module discovery falls back to
		// listing directories under .claude/design/, and the recommended-
		// section check falls back to the historical default list.
		writeFileAt(".claude/design/mod/a.md", overviewOnlyDoc());

		const { stdout } = run(repo);
		expect(stdout).toContain("Missing recommended section 'Current State'");
		expect(stdout).toContain("Missing recommended section 'Rationale'");
	});
});

describe("validate.sh case-insensitive heading matching", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "validate-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	function config(minSections: string[]): string {
		return JSON.stringify({
			version: "1.0.0",
			modules: { mod: { path: "mod", designDocsPath: ".claude/design/mod", categories: ["architecture"] } },
			quality: { designDocs: { requireFrontmatter: true, requireTOC: true, minSections } },
		});
	}

	// A doc that follows the design-docs-style sentence-case heading rule
	// ("Current state", not "Current State").
	function sentenceCaseDoc(): string {
		return [
			"---",
			"status: current",
			"module: mod",
			"category: architecture",
			"created: 2026-01-01",
			"updated: 2026-01-01",
			"last-synced: 2026-01-01",
			"completeness: 80",
			"related: []",
			"dependencies: []",
			"---",
			"",
			"## Overview",
			"",
			"Body.",
			"",
			"## Current state",
			"",
			"Body.",
			"",
			"## Rationale",
			"",
			"Body.",
			"",
		].join("\n");
	}

	test("does not warn about a sentence-case heading that matches a title-case required section", () => {
		writeFileAt(".claude/design/design.config.json", config(["Overview", "Current State", "Rationale"]));
		writeFileAt(".claude/design/mod/a.md", sentenceCaseDoc());

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Missing recommended section");
	});
});

describe("validate.sh status-completeness bands", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "validate-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	// minSections: [] opts out of recommended-section warnings so the
	// status-completeness warning is the only thing under test.
	function config(): string {
		return JSON.stringify({
			version: "1.0.0",
			modules: { mod: { path: "mod", designDocsPath: ".claude/design/mod", categories: ["architecture"] } },
			quality: { designDocs: { requireFrontmatter: true, requireTOC: false, minSections: [] } },
		});
	}

	function docWith(status: string, completeness: number): string {
		return [
			"---",
			`status: ${status}`,
			"module: mod",
			"category: architecture",
			"created: 2026-01-01",
			"updated: 2026-01-01",
			"last-synced: 2026-01-01",
			`completeness: ${completeness}`,
			"related: []",
			"dependencies: []",
			"---",
			"",
			"## Overview",
			"",
			"Body.",
			"",
		].join("\n");
	}

	test("draft with completeness 72 does not warn (design fleshed out, code not yet written)", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWith("draft", 72));

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Status 'draft' but completeness");
	});

	test("draft with completeness 95 warns (above the 21-90 range)", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWith("draft", 95));

		const { stdout } = run(repo);
		expect(stdout).toContain("Status 'draft' but completeness 95 outside 21-90 range");
	});

	test("draft with completeness 15 warns (below the 21-90 range)", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWith("draft", 15));

		const { stdout } = run(repo);
		expect(stdout).toContain("Status 'draft' but completeness 15 outside 21-90 range");
	});

	test("stub with completeness 21 still warns (unchanged band)", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWith("stub", 21));

		const { stdout } = run(repo);
		expect(stdout).toContain("Status 'stub' but completeness 21 > 20");
	});

	test("current with completeness 60 still warns (unchanged band)", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", docWith("current", 60));

		const { stdout } = run(repo);
		expect(stdout).toContain("Status 'current' but completeness 60 < 61");
	});
});

describe("validate.sh hard-wrapped prose detection", () => {
	let repo: string;

	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), "validate-"));
	});

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true });
	});

	function writeFileAt(rel: string, content: string): void {
		const path = join(repo, rel);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, content);
	}

	// minSections: [] opts out of recommended-section warnings so hard-wrap
	// warnings are the only thing under test.
	function config(): string {
		return JSON.stringify({
			version: "1.0.0",
			modules: { mod: { path: "mod", designDocsPath: ".claude/design/mod", categories: ["architecture"] } },
			quality: { designDocs: { requireFrontmatter: true, requireTOC: false, minSections: [] } },
		});
	}

	const frontmatter = [
		"---",
		"status: current",
		"module: mod",
		"category: architecture",
		"created: 2026-01-01",
		"updated: 2026-01-01",
		"last-synced: 2026-01-01",
		"completeness: 80",
		"related: []",
		"dependencies: []",
		"---",
		"",
	];

	function docWithBody(bodyLines: string[]): string {
		return [...frontmatter, ...bodyLines].join("\n");
	}

	test("single-line paragraphs pass without warning", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(
			".claude/design/mod/a.md",
			docWithBody(["## Overview", "", "Paragraph one on a single line.", "", "Paragraph two on a single line.", ""]),
		);

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Hard-wrapped prose detected");
	});

	test("a hard-wrapped paragraph warns", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(
			".claude/design/mod/a.md",
			docWithBody([
				"## Overview",
				"",
				"This is a paragraph that wraps",
				"onto a second source line for no good reason.",
				"",
			]),
		);

		const { stdout } = run(repo);
		expect(stdout).toContain("Hard-wrapped prose detected");
		expect(stdout).toContain("paragraphs must occupy a single source line");
	});

	test("a list item with a continuation line warns", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(
			".claude/design/mod/a.md",
			docWithBody(["## Overview", "", "- First item", "  continues without a marker on the next line", ""]),
		);

		const { stdout } = run(repo);
		expect(stdout).toContain("Hard-wrapped prose detected");
	});

	test("consecutive single-line list items never warn", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(
			".claude/design/mod/a.md",
			docWithBody(["## Overview", "", "- First item", "- Second item", "- Third item", ""]),
		);

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Hard-wrapped prose detected");
	});

	test("fenced code blocks never warn even with wrapped-looking lines", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(
			".claude/design/mod/a.md",
			docWithBody([
				"## Overview",
				"",
				"```text",
				"this looks like it wraps",
				"onto a second line but it is code",
				"```",
				"",
			]),
		);

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Hard-wrapped prose detected");
	});

	test("tables never warn", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(
			".claude/design/mod/a.md",
			docWithBody(["## Overview", "", "| Col A | Col B |", "| --- | --- |", "| val1 | val2 |", ""]),
		);

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Hard-wrapped prose detected");
	});
});
