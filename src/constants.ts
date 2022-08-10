import DEFAULT_TEMPLATE from './assets/defaultTemplate.njk';
import type { RaindropPluginSettings } from "./types";

export const VERSION = '0.0.10';

export const DEFAULT_SETTINGS: RaindropPluginSettings = {
	version: VERSION,
	username: undefined,
	isConnected: false,
	ribbonIcon: true,
	highlightsFolder: '/',
	syncCollections: {
		'-1': {
			id: -1,
			title: 'Unsorted',
			sync: false,
			lastSyncDate: undefined,
		},
		'-99': {
			id: -99,
			title: 'Trash',
			sync: false,
			lastSyncDate: undefined,
		}
	},
	template: DEFAULT_TEMPLATE,
	dateTimeFormat: 'YYYY/MM/DD HH:mm:ss',
	autoSyncInterval: 0,
};
