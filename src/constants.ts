import z from "zod";
import DEFAULT_TEMPLATE from "./assets/defaultTemplate.njk";

export const VERSION = "0.0.23";

export const ZPluginSettings = z.object({
	version: z.string().optional().default(VERSION),
	username: z.string().optional(),
	isConnected: z.boolean().optional().default(false),
	ribbonIcon: z.boolean().optional().default(true),
	appendMode: z.boolean().optional().default(true),
	collectionsFolders: z.boolean().optional().default(true),
	onlyBookmarksWithHl: z.boolean().optional().default(false),
	highlightsFolder: z.string().optional().default("/"),
	collectionGroups: z.boolean().optional().default(false),
	autoSyncSuccessNotice: z.boolean().optional().default(true),
	syncCollections: z
		.record(
			z.string(),
			z
				.object({
					id: z.number(),
					title: z.string(),
					sync: z.boolean(),
					lastSyncDate: z.coerce.date().optional(),
				})
				.optional(),
		)
		.optional()
		.default({}),
	template: z.string().optional().default(DEFAULT_TEMPLATE),
	metadataTemplate: z.string().optional().default(""),
	filenameTemplate: z.string().optional().default("{{title}}"),
	preventMovingExistingFiles: z.boolean().optional().default(true),
	autoSyncInterval: z.number().optional().default(0),
	autoescape: z.boolean().optional().default(true),
});

export type ZPluginSettingsType = z.infer<typeof ZPluginSettings>;

export const DEFAULT_SETTINGS: ZPluginSettingsType = {
	version: VERSION,
	username: undefined,
	isConnected: false,
	ribbonIcon: true,
	appendMode: true,
	collectionsFolders: true,
	onlyBookmarksWithHl: false,
	highlightsFolder: "/",
	collectionGroups: false,
	autoSyncSuccessNotice: true,
	syncCollections: {},
	template: DEFAULT_TEMPLATE,
	metadataTemplate: "",
	filenameTemplate: "{{title}}",
	preventMovingExistingFiles: true,
	autoSyncInterval: 0,
	autoescape: true,
};
