import type { TFile } from "obsidian";
import z from "zod";
import { VERSION } from "./constants";
import DEFAULT_TEMPLATE from "./assets/defaultTemplate.njk";
import DEFAULT_FILENAME_TEMPLATE from "./assets/defaultFilenameTemplate.njk";

export interface RaindropUser {
	// Remote state
	fullName: string;
	groups: {
		collections: number[];
		title: string;
	}[];
}

export interface RaindropCollection {
	// Remote state
	title: string;
	id: number;
	parentId: number | null;
}

export interface RaindropCollectionGroup {
	// Remote state
	title: string;
	collections: number[];
}

export interface RaindropHighlight {
	id: string;
	color: string;
	created: Date;
	lastUpdate: Date;
	note: string;
	text: string;
	signature: string;
}

export interface RaindropCreatorRef {
	// Remote state
	name: string;
	id: number;
}

export interface RaindropBookmark {
	// Remote state
	id: number;
	collectionId: number;
	title: string;
	highlights: RaindropHighlight[];
	excerpt: string;
	note: string;
	link: string;
	lastUpdate: Date;
	tags: string[];
	cover: string;
	created: Date;
	type: string;
	important: boolean;
	creator: RaindropCreatorRef;
}

// ----------

export interface BookmarkFile {
	raindropId: number;
	file: TFile;
}

export interface BookmarkFileFrontMatter {
	// use snake_case in front matter
	raindrop_id: number;
	raindrop_highlights?: { [id: string]: string };
	[key: string]: unknown;
}

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
	autoSyncAllCollections: z.boolean().optional().default(true),
	autoSyncNewNestedCollections: z.boolean().optional().default(false),
	syncCollections: z
		.record(
			z.string(),
			z.object({
				id: z.number(),
				title: z.string(),
				sync: z.boolean(),
				lastSyncDate: z.coerce.date().optional(),
				parentId: z.number().optional(),
				search: z.string().optional(),
			}),
		)
		.optional()
		.default({}),
	template: z.string().optional().default(DEFAULT_TEMPLATE),
	metadataTemplate: z.string().optional().default(""),
	filenameTemplate: z.string().optional().default(DEFAULT_FILENAME_TEMPLATE),
	preventMovingExistingFiles: z.boolean().optional().default(true),
	autoSyncInterval: z.number().optional().default(0),
	autoescape: z.boolean().optional().default(true),
});

export type ZPluginSettingsType = z.infer<typeof ZPluginSettings>;

export type SyncCollections = z.infer<typeof ZPluginSettings>["syncCollections"];
export type SyncCollection = NonNullable<SyncCollections[string]>;

export type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
