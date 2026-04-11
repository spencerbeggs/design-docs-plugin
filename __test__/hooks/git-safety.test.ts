import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK_PATH = join(import.meta.dir, "../../plugin/hooks/git-safety.sh");

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
	if (proc.exitCode !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${proc.stderr.toString()}`);
	}
	return proc.stdout.toString().trim();
}

function createGitRepo(branch?: string): string {
	const dir = mkdtempSync(join(tmpdir(), "git-safety-test-"));
	git(dir, "init", "-b", "main");
	git(dir, "commit", "--allow-empty", "-m", "initial commit");
	if (branch) {
		git(dir, "checkout", "-b", branch);
	}
	return dir;
}

function runHook(command: string, cwd: string, env: Record<string, string> = {}) {
	const stdin = JSON.stringify({
		tool_name: "Bash",
		tool_input: { command },
	});
	const proc = Bun.spawnSync(["bash", HOOK_PATH], {
		cwd,
		env: { ...process.env, ...env },
		stdin: Buffer.from(stdin),
	});
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

describe("git-safety.sh", () => {
	let tempDir: string;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe("on default branch", () => {
		test("blocks git push --force origin main", () => {
			tempDir = createGitRepo();
			const result = runHook("git push --force origin main", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks git push -f origin main", () => {
			tempDir = createGitRepo();
			const result = runHook("git push -f origin main", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks git push --force-with-lease origin main", () => {
			tempDir = createGitRepo();
			const result = runHook("git push --force-with-lease origin main", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks git reset --hard HEAD~1", () => {
			tempDir = createGitRepo();
			const result = runHook("git reset --hard HEAD~1", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks git reset --soft HEAD~1", () => {
			tempDir = createGitRepo();
			const result = runHook("git reset --soft HEAD~1", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks git rebase origin/main", () => {
			tempDir = createGitRepo();
			const result = runHook("git rebase origin/main", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks git branch -D main", () => {
			tempDir = createGitRepo();
			const result = runHook("git branch -D main", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("allows deleting non-default branch from main", () => {
			tempDir = createGitRepo();
			const result = runHook("git branch -D old-feature", tempDir);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});
	});

	describe("on feature branch", () => {
		test("auto-allows git push --force origin feat/test", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("git push --force origin feat/test", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("allow");
		});

		test("auto-allows git reset --soft HEAD~3", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("git reset --soft HEAD~3", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("allow");
		});

		test("auto-allows git reset --hard HEAD~1", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("git reset --hard HEAD~1", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("allow");
		});

		test("auto-allows git rebase main", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("git rebase main", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("allow");
		});

		test("auto-allows git push --force-with-lease origin feat/test", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("git push --force-with-lease origin feat/test", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("allow");
		});

		test("blocks git branch -D main from feature branch", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("git branch -D main", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});
	});

	describe("always blocked", () => {
		test("blocks gh repo delete on any branch", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("gh repo delete my-repo --yes", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks gh api branch protection delete", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("gh api repos/owner/repo/branches/main/protection -X DELETE", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});

		test("blocks gh pr merge --admin", () => {
			tempDir = createGitRepo("feat/test");
			const result = runHook("gh pr merge 123 --admin", tempDir);

			expect(result.exitCode).toBe(0);
			const json = JSON.parse(result.stdout);
			expect(json.hookSpecificOutput.permissionDecision).toBe("deny");
		});
	});

	describe("non-git commands", () => {
		test("skips ls -la", () => {
			tempDir = createGitRepo();
			const result = runHook("ls -la", tempDir);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});

		test("skips git status", () => {
			tempDir = createGitRepo();
			const result = runHook("git status", tempDir);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});

		test("skips git log --oneline", () => {
			tempDir = createGitRepo();
			const result = runHook("git log --oneline", tempDir);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toBe("");
		});
	});

	test("exits silently when disabled", () => {
		tempDir = createGitRepo();
		const result = runHook("git push --force origin main", tempDir, {
			DESIGN_DOCS_CONTEXT_ENABLED: "false",
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});
});
