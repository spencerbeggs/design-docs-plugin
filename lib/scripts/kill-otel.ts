#!/usr/bin/env bun
/**
 * Kill any running OTEL sidecar processes.
 * Usage: bun run kill:otel
 */

import { $ } from "bun";

const PROCESS_PATTERNS = ["otel", "sidecar"];

interface ProcessInfo {
	pid: number;
	command: string;
}

async function findProcesses(pattern: string): Promise<ProcessInfo[]> {
	const result = await $`pgrep -fl ${pattern}`.quiet().nothrow();

	if (result.exitCode !== 0 || !result.stdout.toString().trim()) {
		return [];
	}

	return result.stdout
		.toString()
		.trim()
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => {
			const [pid, ...rest] = line.split(" ");
			return {
				pid: Number.parseInt(pid as string, 10),
				command: rest.join(" "),
			};
		})
		.filter((p) => !Number.isNaN(p.pid));
}

async function killProcess(pid: number): Promise<boolean> {
	const result = await $`kill ${pid}`.quiet().nothrow();
	return result.exitCode === 0;
}

async function main() {
	if (!process.env.GITHUB_ACTIONS) {
		const allProcesses: ProcessInfo[] = [];

		for (const pattern of PROCESS_PATTERNS) {
			const processes = await findProcesses(pattern);
			for (const proc of processes) {
				// Avoid duplicates
				if (!allProcesses.some((p) => p.pid === proc.pid)) {
					allProcesses.push(proc);
				}
			}
		}

		if (allProcesses.length === 0) {
			console.log("No OTEL/sidecar processes found.");
			return;
		}

		console.log(`Found ${allProcesses.length} process(es):\n`);

		for (const proc of allProcesses) {
			console.log(`  PID ${proc.pid}: ${proc.command}`);
		}

		console.log("");

		let killed = 0;
		for (const proc of allProcesses) {
			const success = await killProcess(proc.pid);
			if (success) {
				console.log(`✓ Killed PID ${proc.pid}`);
				killed++;
			} else {
				console.log(`✗ Failed to kill PID ${proc.pid}`);
			}
		}

		console.log(`\nKilled ${killed}/${allProcesses.length} process(es).`);
	}
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
