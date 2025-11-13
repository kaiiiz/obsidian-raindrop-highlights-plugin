import DEFAULT_TEMPLATE from "./assets/defaultTemplate.njk";
import DEFAULT_FILENAME_TEMPLATE from "./assets/defaultFilenameTemplate.njk";
import type { RaindropCollection, ZPluginSettingsType } from "./types";

export const VERSION = "0.0.23";

export const DEFAULT_SETTINGS: ZPluginSettingsType = {
	version: VERSION,
	username: undefined,
	isConnected: false,
	ribbonIcon: true,
	appendMode: true,
	collectionsFolders: true,
	onlyBookmarksWithHl: false,
	syncDeleteFiles: false,
	syncDeleteUseTrash: true,
	highlightsFolder: "/",
	collectionGroups: false,
	autoSyncSuccessNotice: true,
	autoSyncAllCollections: false,
	autoSyncNewNestedCollections: false,
	syncCollections: {},
	template: DEFAULT_TEMPLATE,
	metadataTemplate: "",
	filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
	preventMovingExistingFiles: true,
	autoSyncInterval: 0,
	autoescape: true,
};

export const SYSTEM_COLLECTIONS: RaindropCollection[] = [
	{ id: 0, title: "All bookmarks", parentId: null },
	{ id: -1, title: "Unsorted", parentId: null },
	{ id: -99, title: "Trash", parentId: null },
];
