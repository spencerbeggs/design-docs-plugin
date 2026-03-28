import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const HOOK_PATH = join(import.meta.dir, "../../plugin/hooks/allow-design-writes.sh");

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

function makeInput(filePath: string): string {
	return JSON.stringify({
		tool_name: "Write",
		tool_input: { file_path: filePath, content: "test" },
	});
}

describe("allow-design-writes.sh", () => {
	test("auto-approves writes to .claude/design/", () => {
		const result = runHook(makeInput("/Users/test/project/.claude/design/module/doc.md"));

		expect(result.exitCode).toBe(0);
		const json = JSON.parse(result.stdout);
		expect(json.hookSpecificOutput.permissionDecision).toBe("allow");
	});

	test("auto-approves writes to .claude/plans/", () => {
		const result = runHook(makeInput("/Users/test/project/.claude/plans/my-plan.md"));

		expect(result.exitCode).toBe(0);
		const json = JSON.parse(result.stdout);
		expect(json.hookSpecificOutput.permissionDecision).toBe("allow");
	});

	test("does not auto-approve writes outside design dirs", () => {
		const result = runHook(makeInput("/Users/test/project/src/main.ts"));

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	test("does not auto-approve when file_path is empty", () => {
		const result = runHook(JSON.stringify({ tool_name: "Write", tool_input: {} }));

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	test("exits silently when disabled", () => {
		const result = runHook(makeInput("/Users/test/project/.claude/design/module/doc.md"), {
			DESIGN_DOCS_CONTEXT_ENABLED: "false",
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});
});
