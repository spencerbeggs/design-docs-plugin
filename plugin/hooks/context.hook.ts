import type { Pipeline } from "../plugin.config.js";

const handler: Pipeline["SessionStart"] = ({ state }) => {
	if (!state.contextEnabled) {
		return {
			status: "disabled",
			summary: "Context injection disabled via DESIGN_DOCS_CONTEXT_ENABLED=false",
		};
	}

	const context = [
		"## Design Documentation System",
		"",
		"This project uses a design documentation system managed by the design-docs plugin.",
		"Design docs live in `docs/design/` and implementation plans in `.claude/plans/`.",
		"",
		"### Available Skills",
		"",
		"Use these slash commands to manage design documentation:",
		"",
		"**Design docs:** `/design-docs:design-init`, `/design-docs:design-validate`, `/design-docs:design-update`, `/design-docs:design-sync`, `/design-docs:design-review`, `/design-docs:design-audit`, `/design-docs:design-search`, `/design-docs:design-compare`, `/design-docs:design-link`, `/design-docs:design-index`, `/design-docs:design-report`, `/design-docs:design-export`, `/design-docs:design-archive`, `/design-docs:design-prune`, `/design-docs:design-config`",
		"",
		"**Plans:** `/design-docs:plan-create`, `/design-docs:plan-validate`, `/design-docs:plan-list`, `/design-docs:plan-explore`, `/design-docs:plan-complete`",
		"",
		"**Context (CLAUDE.md):** `/design-docs:context-validate`, `/design-docs:context-audit`, `/design-docs:context-review`, `/design-docs:context-update`, `/design-docs:context-split`",
		"",
		"**User docs:** `/design-docs:docs-generate-readme`, `/design-docs:docs-generate-repo`, `/design-docs:docs-generate-site`, `/design-docs:docs-generate-contributing`, `/design-docs:docs-generate-security`, `/design-docs:docs-review`, `/design-docs:docs-review-package`, `/design-docs:docs-sync`, `/design-docs:docs-update`",
		"",
		"### Available Agents",
		"",
		"**design-doc-agent** — Maintain internal design documentation and implementation plans",
		"**context-doc-agent** — Maintain CLAUDE.md context files",
		"**docs-gen-agent** — Generate user-facing documentation from design docs",
	].join("\n");

	return {
		status: "executed",
		action: "context",
		summary: "Injected design documentation system context",
		claudeContext: context,
	};
};

export default handler;
