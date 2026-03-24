import { z } from "zod";

export const optionsSchema = z.object({
	/** Enable context injection into sessions (default: true) */
	CONTEXT_ENABLED: z
		.string()
		.default("true")
		.transform((v) => v !== "false"),
});

export type PluginOptions = z.infer<typeof optionsSchema>;
