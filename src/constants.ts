import DEFAULT_TEMPLATE from './assets/defaultTemplate.njk';
import type { RaindropPluginSettings } from "./types";

export const VERSION = '0.0.14';

export const DEFAULT_SETTINGS: RaindropPluginSettings = {
	version: VERSION,
	username: undefined,
	isConnected: false,
	ribbonIcon: true,
	appendMode: true,
	collectionsFolders: true,
	onlyBookmarksWithHl: false,
	highlightsFolder: '/',
	syncCollections: {},
	template: DEFAULT_TEMPLATE,
	metadataTemplate: "",
	dateTimeFormat: 'YYYY/MM/DD HH:mm:ss',
	autoSyncInterval: 0,
};
