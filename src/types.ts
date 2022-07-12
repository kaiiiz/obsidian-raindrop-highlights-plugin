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
	title: string,
	highlights: RaindropHighlight[],
	excerpt: string,
	link: string,
	lastUpdate: Date,
}

// ----------

export interface ArticleFile {
	raindropId: number,
	file: TFile;
}

export interface ArticleFileFrontMatter { // use snake_case in front matter
	raindrop_id: number,
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
	token: string,
	highlightsFolder: string;
	syncCollections: SyncCollectionSettings;
	template: string;
	dateTimeFormat: string;
}
