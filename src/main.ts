import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { RaindropSettingTab } from './store/settings';
import { TokenManager } from './store/token';
import RaindropSync from './sync';

interface RaindropPluginSettings {
	highlightsFolder: string;
	lastSyncDate?: Date;
	syncCollections: Array<string>;
}

const DEFAULT_SETTINGS: RaindropPluginSettings = {
	highlightsFolder: '',
	lastSyncDate: undefined,
	syncCollections: [],
}

export default class RaindropPlugin extends Plugin {
	private raindropSync: RaindropSync;
	tokenManager: TokenManager;
	settings: RaindropPluginSettings;

	async onload() {
		await this.loadSettings();

		this.tokenManager = new TokenManager(this.app)
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
