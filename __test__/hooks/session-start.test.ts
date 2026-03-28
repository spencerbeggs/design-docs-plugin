import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK_PATH = join(import.meta.dir, "../../plugin/hooks/session-start.sh");

function runHook(env: Record<string, string> = {}) {
	const proc = Bun.spawnSync(["bash", HOOK_PATH], {
		env: { ...process.env, ...env },
		stdin: "pipe",
	});
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

describe("session-start.sh", () => {
	let tempDir: string;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("outputs design docs context when enabled", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		const result = runHook({ CLAUDE_PROJECT_DIR: tempDir });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Design Documentation System");
		expect(result.stdout).toContain("design-doc-agent");
		expect(result.stdout).toContain("institutional memory");
	});

	test("outputs nothing when disabled", () => {
		const result = runHook({ DESIGN_DOCS_CONTEXT_ENABLED: "false" });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	test("shows initialization guidance when .claude/design/ is missing", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		const result = runHook({ CLAUDE_PROJECT_DIR: tempDir });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("not yet initialized");
		expect(result.stdout).toContain("design-config");
		expect(result.stdout).not.toContain("institutional memory");
	});

	test("context message is under 40 lines", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		const result = runHook({ CLAUDE_PROJECT_DIR: tempDir });
		const lines = result.stdout.trim().split("\n");

		expect(lines.length).toBeLessThanOrEqual(50);
	});
});
