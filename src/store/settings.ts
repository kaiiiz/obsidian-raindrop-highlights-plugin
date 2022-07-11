import {App, Notice, PluginSettingTab, Setting} from 'obsidian';
import { RaindropAPI } from 'src/api';
import RaindropPlugin from '../main';

export class RaindropSettingTab extends PluginSettingTab {
	private plugin: RaindropPlugin;
	private api: RaindropAPI;

	constructor(app: App, plugin: RaindropPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.api = new RaindropAPI(app, plugin.tokenManager);
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		this.token();
		this.highlightsFolder();
		this.collections();
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
					text.setValue(await this.plugin.tokenManager.getToken());
				} catch (e) {
					/* Throw away read error if file does not exist. */
				}

				text.onChange(async (value) => {
					try {
						await this.plugin.tokenManager.setToken(value);
						new Notice('Token saved');
					} catch (e) {
						new Notice('Invalid token');
					}
				});
			});
	}

	private async collections(): Promise<void> {
		// const collections = await this.api.getCollections();
		// const highlightsFolder = this.plugin.settings.highlightsFolder;
		// collections.forEach(async (collection) => {
		// 	try {
		// 		await this.app.vault.createFolder(`${highlightsFolder}/${collection['title']}`);
		// 	} catch (e) {
		// 		/* ignore folder already exists error */
		// 	}
		// });

		// new Setting(this.containerEl)
		// 	.setName('Raindrop.io API token')
		// 	.add

		// 	.setDesc(tokenDescFragment)
		// 	.addText(async (text) => {
		// 		try {
		// 			text.setValue(await this.plugin.tokenManager.getToken());
		// 		} catch (e) {
		// 			/* Throw away read error if file does not exist. */
		// 		}

		// 		text.onChange(async (value) => {
		// 			try {
		// 				await this.plugin.tokenManager.setToken(value);
		// 				new Notice('Token saved');
		// 			} catch (e) {
		// 				new Notice('Invalid token');
		// 			}
		// 		});
		// 	})
	}
}
