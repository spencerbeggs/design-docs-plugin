import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK_PATH = join(import.meta.dir, "../../plugin/hooks/subagent-start.sh");

function runHook(stdin: string = "{}", env: Record<string, string> = {}) {
	const proc = Bun.spawnSync(["bash", HOOK_PATH], {
		env: { ...process.env, ...env },
		stdin: Buffer.from(stdin),
	});
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

describe("subagent-start.sh", () => {
	let tempDir: string;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("outputs valid JSON with additionalContext", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		const result = runHook("{}", { CLAUDE_PROJECT_DIR: tempDir });

		expect(result.exitCode).toBe(0);
		const json = JSON.parse(result.stdout);
		expect(json.hookSpecificOutput.hookEventName).toBe("SubagentStart");
		expect(json.hookSpecificOutput.additionalContext).toContain(".claude/design/");
	});

	test("additionalContext is under 50 words", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		const result = runHook("{}", { CLAUDE_PROJECT_DIR: tempDir });
		const json = JSON.parse(result.stdout);
		const words = json.hookSpecificOutput.additionalContext.split(/\s+/);

		expect(words.length).toBeLessThanOrEqual(50);
	});

	test("outputs nothing when disabled", () => {
		const result = runHook("{}", { DESIGN_DOCS_CONTEXT_ENABLED: "false" });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	test("outputs nothing when design dir is missing", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		const result = runHook("{}", { CLAUDE_PROJECT_DIR: tempDir });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});
});
