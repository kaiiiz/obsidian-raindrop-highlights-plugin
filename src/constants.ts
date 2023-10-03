import DEFAULT_TEMPLATE from "./assets/defaultTemplate.njk";
import type { RaindropPluginSettings } from "./types";

export const VERSION = "0.0.18";

export const DEFAULT_SETTINGS: RaindropPluginSettings = {
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
	autoSyncInterval: 0,
	autoescape: true,
};
