import type { TFile } from "obsidian";

export interface RaindropUser {
	// Remote state
	fullName: string;
}

export interface RaindropCollection {
	// Remote state
	title: string;
	id: number;
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
	[key: string]: any;
}

// ----------

export interface SyncCollection {
	// Local state
	id: number;
	title: string;
	sync: boolean;
	lastSyncDate?: Date;
}

export interface SyncCollectionSettings {
	[id: number]: SyncCollection;
}

export interface RaindropPluginSettings {
	version: string;
	username?: string;
	isConnected: boolean;
	ribbonIcon: boolean;
	appendMode: boolean;
	collectionsFolders: boolean;
	onlyBookmarksWithHl: boolean;
	highlightsFolder: string;
	collectionGroups: boolean;
	syncCollections: SyncCollectionSettings;
	template: string;
	metadataTemplate: string;
	filenameTemplate: string;
	autoSyncInterval: number;
	autoSyncSuccessNotice: boolean;
}
