import DEFAULT_TEMPLATE from "./assets/defaultTemplate.njk";
import DEFAULT_FILENAME_TEMPLATE from "./assets/defaultFilenameTemplate.njk";
import type { ZPluginSettingsType } from "./types";

export const VERSION = "0.0.23";

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
	autoCheckAllCollectionsOnSync: false,
	autoCheckNestedCollectionsOnSync: false,
	syncCollections: {},
	template: DEFAULT_TEMPLATE,
	metadataTemplate: "",
	filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
	preventMovingExistingFiles: true,
	autoSyncInterval: 0,
	autoescape: true,
};
