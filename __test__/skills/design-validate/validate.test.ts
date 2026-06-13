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

	test("falls back to the default section list when config omits minSections", () => {
		writeFileAt(".claude/design/design.config.json", config());
		writeFileAt(".claude/design/mod/a.md", overviewOnlyDoc());

		const { stdout } = run(repo);
		expect(stdout).toContain("Missing recommended section 'Current State'");
		expect(stdout).toContain("Missing recommended section 'Rationale'");
	});

	test("treats an empty minSections array as 'no required sections'", () => {
		writeFileAt(".claude/design/design.config.json", config([]));
		writeFileAt(".claude/design/mod/a.md", overviewOnlyDoc());

		const { stdout } = run(repo);
		expect(stdout).not.toContain("Missing recommended section");
	});
});
