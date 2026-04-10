import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK_PATH = join(import.meta.dir, "../../plugin/hooks/git-safety-mcp.sh");

function git(repoDir: string, ...args: string[]) {
	const proc = Bun.spawnSync(["git", ...args], {
		cwd: repoDir,
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "test@test.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "test@test.com",
		},
	});
	return proc.stdout.toString().trim();
}

function createGitRepo(branch = "main"): string {
	const dir = mkdtempSync(join(tmpdir(), "git-safety-mcp-test-"));
	git(dir, "init", "-b", "main");
	Bun.spawnSync(["bash", "-c", "echo 'init' > README.md"], { cwd: dir });
	git(dir, "add", ".");
	git(dir, "commit", "-m", "initial commit");
	if (branch !== "main") {
		git(dir, "checkout", "-b", branch);
	}
	return dir;
}

function runHook(toolName: string, toolInput: Record<string, unknown>, cwd: string, env: Record<string, string> = {}) {
	const input = JSON.stringify({
		tool_name: toolName,
		tool_input: toolInput,
	});
	const proc = Bun.spawnSync(["bash", HOOK_PATH], {
		env: { ...process.env, ...env },
		stdin: Buffer.from(input),
		cwd,
	});
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

interface HookOutput {
	hookSpecificOutput: {
		hookEventName: string;
		permissionDecision: string;
		permissionDecisionReason?: string;
	};
}

describe("git-safety-mcp.sh", () => {
	let repoDir: string;

	afterEach(() => {
		if (repoDir) {
			rmSync(repoDir, { recursive: true, force: true });
		}
	});

	describe("on default branch", () => {
		test("blocks mcp__gitkraken__git_push with force", () => {
			repoDir = createGitRepo("main");
			const result = runHook(
				"mcp__gitkraken__git_push",
				{ repoPath: repoDir, remote: "origin", branch: "main", force: true },
				repoDir,
			);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout) as HookOutput;
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks mcp__gitkraken__git_branch delete targeting default", () => {
			repoDir = createGitRepo("main");
			const result = runHook(
				"mcp__gitkraken__git_branch",
				{ repoPath: repoDir, action: "delete", branchName: "main" },
				repoDir,
			);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout) as HookOutput;
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});
	});

	describe("on feature branch", () => {
		test("auto-allows mcp__gitkraken__git_push with force", () => {
			repoDir = createGitRepo("feat/test");
			const result = runHook(
				"mcp__gitkraken__git_push",
				{ repoPath: repoDir, remote: "origin", branch: "feat/test", force: true },
				repoDir,
			);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout) as HookOutput;
			expect(json.hookSpecificOutput.permissionDecision).toBe("allow");
		});
	});

	describe("non-matching tools", () => {
		test("skips unrelated MCP tools", () => {
			repoDir = createGitRepo("main");
			const result = runHook("mcp__gitkraken__git_status", { repoPath: repoDir }, repoDir);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});
	});

	test("exits silently when disabled", () => {
		repoDir = createGitRepo("main");
		const result = runHook(
			"mcp__gitkraken__git_push",
			{ repoPath: repoDir, remote: "origin", branch: "main", force: true },
			repoDir,
			{ DESIGN_DOCS_CONTEXT_ENABLED: "false" },
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});
});
