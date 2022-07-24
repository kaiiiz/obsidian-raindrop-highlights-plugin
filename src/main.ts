import { Notice, Plugin } from 'obsidian';
import { RaindropSettingTab } from './settings';
import RaindropSync from './sync';
import type { RaindropCollection, RaindropPluginSettings } from './types';
import DEFAULT_TEMPLATE from './assets/defaultTemplate.njk';
import { RaindropAPI } from './api';


const DEFAULT_SETTINGS: RaindropPluginSettings = {
	username: undefined,
	isConnected: false,
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

export default class RaindropPlugin extends Plugin {
	private raindropSync: RaindropSync;
	public settings: RaindropPluginSettings;
	public api: RaindropAPI;
	private timeoutIDAutoSync?: number;

	async onload() {
		await this.loadSettings();

		this.api = new RaindropAPI(this.app);
		this.raindropSync = new RaindropSync(this.app, this, this.api);

		this.addCommand({
			id: 'raindrop-sync',
			name: 'Sync highlights',
			callback: async () => {
				await this.raindropSync.sync();
			}
		});

		this.addCommand({
			id: 'raindrop-show-last-sync-time',
			name: 'Show last sync time',
			callback: async () => {
				let message = "";
				for (let id in this.settings.syncCollections) {
					const collection = this.settings.syncCollections[id];
					if (collection.sync) {
						message += `${collection.title}: ${collection.lastSyncDate?.toLocaleString()}\n`
					}
				}
				new Notice(message);
			}
		});

		this.addSettingTab(new RaindropSettingTab(this.app, this, this.api));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		for (let id in this.settings.syncCollections) {
			const collection = this.settings.syncCollections[id];
			if (collection.lastSyncDate) {
				collection.lastSyncDate = new Date(collection.lastSyncDate);
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async updateCollectionSettings(collections: RaindropCollection[]) {
		const syncCollections = this.settings.syncCollections;
		collections.forEach(async (collection) => {
			const {id, title} = collection;

			if (!(id in syncCollections)) {
				syncCollections[id] = {
					id: id,
					title: title,
					sync: false,
					lastSyncDate: undefined,
				};
			} else {
				syncCollections[id].title = title;
			}
		});
		await this.saveSettings();
	}

	async clearAutoSync(): Promise<void> {
		if (this.timeoutIDAutoSync) {
			window.clearTimeout(this.timeoutIDAutoSync);
			this.timeoutIDAutoSync = undefined;
		}
		console.log('Clearing auto sync...');
	}

	async startAutoSync(minutes?: number): Promise<void> {
		const minutesToSync = minutes ?? this.settings.autoSyncInterval;
		if (minutesToSync > 0) {
			this.timeoutIDAutoSync = window.setTimeout(
				() => {
					this.raindropSync.sync();
					this.startAutoSync();
				},
				minutesToSync * 60000
			);
		}
		console.log(`StartAutoSync: this.timeoutIDAutoSync ${this.timeoutIDAutoSync} with ${minutesToSync} minutes`);
	}
}
