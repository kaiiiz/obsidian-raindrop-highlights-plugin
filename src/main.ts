import { Notice, Plugin } from 'obsidian';
import { RaindropSettingTab } from './settings';
import RaindropSync from './sync';
import type { RaindropCollection, RaindropPluginSettings } from './types';
import DEFAULT_TEMPLATE from './assets/defaultTemplate.njk';
import TokenManager from './tokenManager';


const DEFAULT_SETTINGS: RaindropPluginSettings = {
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
};

export default class RaindropPlugin extends Plugin {
	private raindropSync: RaindropSync;
	public settings: RaindropPluginSettings;
	public tokenManager: TokenManager;

	async onload() {
		await this.loadSettings();

		this.tokenManager = new TokenManager();
		this.raindropSync = new RaindropSync(this.app, this);

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

		this.addSettingTab(new RaindropSettingTab(this.app, this));
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
}
