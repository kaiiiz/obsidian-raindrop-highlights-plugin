import {App, Notice, PluginSettingTab, Setting} from 'obsidian';
import RaindropPlugin from '../main';
import { TokenManager } from './token';

export interface RaindropPluginSettings {
	highlightsFolder: string;
}

export const DEFAULT_SETTINGS: RaindropPluginSettings = {
	highlightsFolder: '',
}

export class RaindropSettingTab extends PluginSettingTab {
	plugin: RaindropPlugin;
	private tokenManager: TokenManager;

	constructor(app: App, plugin: RaindropPlugin, tokenManager: TokenManager) {
		super(app, plugin);
		this.plugin = plugin;
		this.tokenManager = tokenManager;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		this.token();
		this.highlightsFolder();
	}

	private highlightsFolder(): void {
		new Setting(this.containerEl)
		  .setName('Highlights folder location')
		  .setDesc('Vault folder to use for writing Raindrop.io highlights')
		  .addDropdown((dropdown) => {
			const files = (this.app.vault.adapter as any).files;
			Object.keys(files).forEach((key) => {
				if (files[key].type == 'folder') {
					const folder = files[key].realpath;
					dropdown.addOption(folder, folder);
				}
			})

			return dropdown
				.setValue(this.plugin.settings.highlightsFolder)
				.onChange(async (value) => {
					this.plugin.settings.highlightsFolder = value;
					await this.plugin.saveSettings();
				});
		  });
	  }

	private token(): void {
		const tokenDesc = 'Get "Test token" in <a href="https://app.raindrop.io/settings/integrations">https://app.raindrop.io/settings/integrations</a>.';

		const tokenDescFragment = document
			.createRange()
			.createContextualFragment(tokenDesc);

		new Setting(this.containerEl)
			.setName('Raindrop.io API token')
			.setDesc(tokenDescFragment)
			.addText(async (text) => {
				try {
					text.setValue(await this.tokenManager.getToken());
				} catch (e) {
					/* Throw away read error if file does not exist. */
				}

				text.onChange(async (value) => {
					try {
						await this.tokenManager.setToken(value);
						new Notice('Token saved');
					} catch (e) {
						new Notice('Invalid token');
					}
				});
			})
	}
}
