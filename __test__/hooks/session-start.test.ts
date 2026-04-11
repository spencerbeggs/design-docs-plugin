import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOK_PATH = join(import.meta.dir, "../../plugin/hooks/session-start.sh");

interface HookOutput {
	hookSpecificOutput: {
		hookEventName: string;
		additionalContext: string;
	};
}

function runHook(env: Record<string, string> = {}) {
	const tmpCwd = mkdtempSync(join(tmpdir(), "hook-nogit-"));
	const proc = Bun.spawnSync(["bash", HOOK_PATH], {
		cwd: tmpCwd,
		env: { ...process.env, ...env },
		stdin: "pipe",
	});
	rmSync(tmpCwd, { recursive: true, force: true });
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

function parseContext(stdout: string): string {
	const parsed = JSON.parse(stdout) as HookOutput;
	return parsed.hookSpecificOutput.additionalContext;
}

describe("session-start.sh", () => {
	let tempDir: string;

	afterEach(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("outputs valid JSON with hookEventName", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		const result = runHook({ CLAUDE_PROJECT_DIR: tempDir });

		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout) as HookOutput;
		expect(parsed.hookSpecificOutput.hookEventName).toBe("SessionStart");
	});

	test("outputs design docs context when enabled", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		const result = runHook({ CLAUDE_PROJECT_DIR: tempDir });
		const context = parseContext(result.stdout);

		expect(result.exitCode).toBe(0);
		expect(context).toContain("<design_documentation_system>");
		expect(context).toContain("design-doc-agent");
		expect(context).toContain("institutional memory");
	});

	test("wraps context in EXTREMELY_IMPORTANT tags", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		const result = runHook({ CLAUDE_PROJECT_DIR: tempDir });
		const context = parseContext(result.stdout);

		expect(context).toContain("<EXTREMELY_IMPORTANT>");
		expect(context).toContain("</EXTREMELY_IMPORTANT>");
	});

	test("outputs nothing when disabled", () => {
		const result = runHook({ DESIGN_DOCS_CONTEXT_ENABLED: "false" });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	test("creates directories and includes init notice when .claude/design/ is missing", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		const result = runHook({ CLAUDE_PROJECT_DIR: tempDir });
		const context = parseContext(result.stdout);

		expect(result.exitCode).toBe(0);
		// Should create the directories
		expect(existsSync(join(tempDir, ".claude", "design"))).toBe(true);
		expect(existsSync(join(tempDir, ".claude", "plans"))).toBe(true);
		// Should include init notice AND the full context
		expect(context).toContain("<action_required>");
		expect(context).toContain("design-init");
		expect(context).toContain("institutional memory");
	});

	test("uses XML structure for context", () => {
		tempDir = mkdtempSync(join(tmpdir(), "hook-test-"));
		mkdirSync(join(tempDir, ".claude", "design"), { recursive: true });
		const result = runHook({ CLAUDE_PROJECT_DIR: tempDir });
		const context = parseContext(result.stdout);

		expect(context).toContain("<purpose>");
		expect(context).toContain("<when_to_update>");
		expect(context).toContain("<how_to_update>");
		expect(context).toContain("<available_skills>");
	});
});

// --- Session Tag Management Tests ---

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
		throw new Error(`git ${args.join(" ")} failed (exit ${proc.exitCode}): ${proc.stderr.toString()}`);
	}
	return proc.stdout.toString().trim();
}

function createGitRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), "hook-git-test-"));
	git(dir, "init", "-b", "main");
	// Create an initial commit so we have a valid history
	mkdirSync(join(dir, ".claude", "design"), { recursive: true });
	Bun.spawnSync(["bash", "-c", "echo 'init' > README.md"], { cwd: dir });
	git(dir, "add", "-A");
	git(dir, "commit", "-m", "initial commit");
	return dir;
}

function runHookInGitRepo(repoDir: string, env: Record<string, string> = {}) {
	const proc = Bun.spawnSync(["bash", HOOK_PATH], {
		cwd: repoDir,
		env: { ...process.env, CLAUDE_PROJECT_DIR: repoDir, ...env },
		stdin: "pipe",
	});
	return {
		exitCode: proc.exitCode,
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
	};
}

describe("session tag management", () => {
	let repoDir: string;

	afterEach(() => {
		if (repoDir) {
			rmSync(repoDir, { recursive: true, force: true });
		}
	});

	test("skips tag management on default branch", () => {
		repoDir = createGitRepo();
		// We are on main (the default branch)
		const result = runHookInGitRepo(repoDir);
		const context = parseContext(result.stdout);

		expect(result.exitCode).toBe(0);
		expect(context).not.toContain("<branch_session>");
	});

	test("creates session/start tag on feature branch at merge-base", () => {
		repoDir = createGitRepo();
		// Create a feature branch and add a commit
		git(repoDir, "checkout", "-b", "feature/test-branch");
		Bun.spawnSync(["bash", "-c", "echo 'feature work' > feature.txt"], {
			cwd: repoDir,
		});
		git(repoDir, "add", "-A");
		git(repoDir, "commit", "-m", "feature commit");

		const mergeBase = git(repoDir, "merge-base", "main", "HEAD");
		const result = runHookInGitRepo(repoDir);
		const context = parseContext(result.stdout);

		expect(result.exitCode).toBe(0);
		expect(context).toContain("<branch_session>");
		expect(context).toContain("<branch>feature/test-branch</branch>");
		expect(context).toContain(`>${mergeBase}</session_tag>`);
		expect(context).toContain("<commits_ahead>1</commits_ahead>");
		expect(context).toContain("<status>created</status>");

		// Verify the tag actually exists at the merge-base
		const tagRef = git(repoDir, "rev-parse", "session/start");
		expect(tagRef).toBe(mergeBase);
	});

	test("reports existing tag without moving it", () => {
		repoDir = createGitRepo();
		git(repoDir, "checkout", "-b", "feature/existing-tag");
		Bun.spawnSync(["bash", "-c", "echo 'first' > first.txt"], {
			cwd: repoDir,
		});
		git(repoDir, "add", "-A");
		git(repoDir, "commit", "-m", "first feature commit");

		// Manually create the tag at the current HEAD
		const tagCommit = git(repoDir, "rev-parse", "HEAD");
		git(repoDir, "tag", "session/start", tagCommit);

		// Add another commit so HEAD moves past the tag
		Bun.spawnSync(["bash", "-c", "echo 'second' > second.txt"], {
			cwd: repoDir,
		});
		git(repoDir, "add", "-A");
		git(repoDir, "commit", "-m", "second feature commit");

		const result = runHookInGitRepo(repoDir);
		const context = parseContext(result.stdout);

		expect(result.exitCode).toBe(0);
		expect(context).toContain("<branch_session>");
		expect(context).toContain("<status>existing</status>");
		expect(context).toContain(`>${tagCommit}</session_tag>`);

		// Tag should NOT have moved
		const tagRefAfter = git(repoDir, "rev-parse", "session/start");
		expect(tagRefAfter).toBe(tagCommit);
	});

	test("creates tag at HEAD when branch is even with main", () => {
		repoDir = createGitRepo();
		// Checkout feature branch but do NOT add any extra commits
		git(repoDir, "checkout", "-b", "feature/even-branch");

		const headCommit = git(repoDir, "rev-parse", "HEAD");
		const result = runHookInGitRepo(repoDir);
		const context = parseContext(result.stdout);

		expect(result.exitCode).toBe(0);
		expect(context).toContain("<branch_session>");
		expect(context).toContain("<branch>feature/even-branch</branch>");
		expect(context).toContain(`>${headCommit}</session_tag>`);
		expect(context).toContain("<commits_ahead>0</commits_ahead>");
		expect(context).toContain("<status>created</status>");

		// The merge-base of an even branch IS HEAD, so tag should be at HEAD
		const tagRef = git(repoDir, "rev-parse", "session/start");
		expect(tagRef).toBe(headCommit);
	});
});
