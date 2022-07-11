import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { RaindropSettingTab, RaindropPluginSettings, DEFAULT_SETTINGS } from './store/settings';
import { TokenManager } from './store/token';
import RaindropSync from './sync';

export default class RaindropPlugin extends Plugin {
	private raindropSync: RaindropSync;
	private tokenManager: TokenManager;
	settings: RaindropPluginSettings;

	async onload() {
		await this.loadSettings();

		this.tokenManager = new TokenManager(this.app)
		this.raindropSync = new RaindropSync(this.app, this.tokenManager);

		this.addCommand({
			id: 'raindrop-sync',
			name: 'Sync highlights',
			callback: async () => {
				await this.raindropSync.sync();
			}
		});

		this.addSettingTab(new RaindropSettingTab(this.app, this, this.tokenManager));
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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
