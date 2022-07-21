import { Plugin } from 'obsidian';
import { RaindropSettingTab } from './settings';
import RaindropSync from './sync';
import type { RaindropCollection, RaindropPluginSettings } from './types';
import DEFAULT_TEMPLATE from './assets/defaultTemplate.njk';


const DEFAULT_SETTINGS: RaindropPluginSettings = {
	token: '',
	highlightsFolder: '',
	syncCollections: {},
	template: DEFAULT_TEMPLATE,
	dateTimeFormat: 'YYYY/MM/DD HH:mm:ss',
};

export default class RaindropPlugin extends Plugin {
	private raindropSync: RaindropSync;
	settings: RaindropPluginSettings;

	async onload() {
		await this.loadSettings();

		this.raindropSync = new RaindropSync(this.app, this);

		this.addCommand({
			id: 'raindrop-sync',
			name: 'Sync highlights',
			callback: async () => {
				await this.raindropSync.sync();
			}
		});

		this.addSettingTab(new RaindropSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
