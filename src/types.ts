import type { TFile } from "obsidian";

export interface RaindropUser { // Remote state
	fullName: string,
}

export interface RaindropCollection { // Remote state
	title: string,
	id: number,
}

export interface RaindropHighlight { // Remote state
	id: string,
	color: string,
	created: Date,
	lastUpdate: Date,
	note: string,
	text: string,
}

export interface RaindropArticle { // Remote state
	id: number,
	collectionId: number,
	title: string,
	highlights: RaindropHighlight[],
	excerpt: string,
	link: string,
	lastUpdate: Date,
	tags: string[],
}

// ----------

export interface ArticleFile {
	raindropId: number,
	file: TFile;
}

export interface ArticleFileFrontMatter { // use snake_case in front matter
	raindrop_id: number,
	raindrop_last_update: string,
}

// ----------

export interface SyncCollection { // Local state
	id: number,
	title: string,
	sync: boolean,
	lastSyncDate?: Date;
}

export interface SyncCollectionSettings {[id: number]: SyncCollection}

export interface RaindropPluginSettings {
	username?: string;
	isConnected: boolean;
	highlightsFolder: string;
	syncCollections: SyncCollectionSettings;
	template: string;
	dateTimeFormat: string;
	autoSyncInterval: number;
}
