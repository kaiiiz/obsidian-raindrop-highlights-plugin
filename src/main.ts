import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { RaindropSettingTab } from './store/settings';
import RaindropSync from './sync';
import type { SyncCollectionSettings } from './types';


interface RaindropPluginSettings {
	token: string,
	highlightsFolder: string;
	lastSyncDate?: Date;
	syncCollections: SyncCollectionSettings;
}

const DEFAULT_SETTINGS: RaindropPluginSettings = {
	token: '',
	highlightsFolder: '',
	lastSyncDate: undefined,
	syncCollections: {},
}

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
}
