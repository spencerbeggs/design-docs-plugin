import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK_PATH = join(import.meta.dir, "../../plugin/hooks/stop-reminder.sh");

function runHook(stdin: string, env: Record<string, string> = {}) {
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

function makeInput(active: boolean, message: string): string {
	return JSON.stringify({
		stop_hook_active: active,
		last_assistant_message: message,
	});
}

describe("stop-reminder.sh", () => {
	let tempDir: string;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	function setupDesignDir(): string {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		return tempDir;
	}

	describe("loop guard", () => {
		test("exits silently when stop_hook_active is true", () => {
			const dir = setupDesignDir();
			const result = runHook(makeInput(true, "I refactored the entire module."), { CLAUDE_PROJECT_DIR: dir });

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});

		test("exits silently when stdin is empty JSON", () => {
			const dir = setupDesignDir();
			const result = runHook("{}", { CLAUDE_PROJECT_DIR: dir });

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});
	});

	describe("keyword detection", () => {
		test("outputs nudge when implementation keywords found", () => {
			const dir = setupDesignDir();
			const result = runHook(makeInput(false, "I refactored the auth module and created a new endpoint."), {
				CLAUDE_PROJECT_DIR: dir,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Implementation work was detected");
			expect(result.stdout).toContain("design-doc-agent");
		});

		test("exits silently for Q&A messages", () => {
			const dir = setupDesignDir();
			const result = runHook(makeInput(false, "Here is the information you requested about the API."), {
				CLAUDE_PROJECT_DIR: dir,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});

		test("detects case-insensitive patterns", () => {
			const dir = setupDesignDir();
			const result = runHook(makeInput(false, "I IMPLEMENTED the new caching layer."), { CLAUDE_PROJECT_DIR: dir });

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Implementation work was detected");
		});

		test("detects 'fixed the' pattern", () => {
			const dir = setupDesignDir();
			const result = runHook(makeInput(false, "I fixed the authentication bug in the login flow."), {
				CLAUDE_PROJECT_DIR: dir,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Implementation work was detected");
		});

		test("does not trigger on 'the' alone", () => {
			const dir = setupDesignDir();
			const result = runHook(makeInput(false, "I read the documentation and found the answer."), {
				CLAUDE_PROJECT_DIR: dir,
			});

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});
	});

	describe("kill switch and first-install", () => {
		test("exits silently when disabled", () => {
			const result = runHook(makeInput(false, "I refactored everything."), { DESIGN_DOCS_CONTEXT_ENABLED: "false" });

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});

		test("exits silently when design dir is missing", () => {
			tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
			const result = runHook(makeInput(false, "I refactored everything."), { CLAUDE_PROJECT_DIR: tempDir });

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});
	});
});
