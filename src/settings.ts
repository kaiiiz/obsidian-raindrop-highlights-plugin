import {App, Notice, PluginSettingTab, Setting} from 'obsidian';
import templateInstructions from './templates/templateInstructions.html';
import tokenInstructions from './templates/tokenInstructions.html';
import datetimeInstructions from './templates/datetimeInstructions.html';
import { RaindropAPI } from './api';
import type RaindropPlugin from './main';
import CollectionsModal from './modal/collections';
import Renderer from './renderer';

export class RaindropSettingTab extends PluginSettingTab {
	private plugin: RaindropPlugin;
	private api: RaindropAPI;
	private renderer: Renderer;

	constructor(app: App, plugin: RaindropPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.renderer = new Renderer(plugin);
		this.api = new RaindropAPI(app, plugin);
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		this.token();
		this.highlightsFolder();
		this.collections();
		this.dateFormat();
		this.template();
		this.resetSyncHistory();
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
		const tokenDescFragment = document
			.createRange()
			.createContextualFragment(tokenInstructions);

		new Setting(this.containerEl)
			.setName('Raindrop.io API token')
			.setDesc(tokenDescFragment)
			.addText(async (text) => {
				try {
					text.setValue(this.plugin.settings.token);
				} catch (e) {
					/* Throw away read error if file does not exist. */
				}

				text.onChange(async (value) => {
					try {
						this.plugin.settings.token = value;
						new Notice('Token saved');
					} catch (e) {
						new Notice('Invalid token');
					}
				});
			});
	}

	private async collections(): Promise<void> {
		new Setting(this.containerEl)
			.setName('Collections')
			.setDesc('Manage collections to be synced')
			.addButton(button => {
				return button
				.setButtonText('Manage')
				.setCta()
				.onClick(async () => {
					// update for new collections
					const allCollections = await this.api.getCollections();
					this.plugin.updateCollectionSettings(allCollections);

					const collectionsModal = new CollectionsModal(this.app, this.plugin);
					this.display(); // rerender
				});
			});
	}

	private async template(): Promise<void> {
		const templateDescFragment = document
			.createRange()
			.createContextualFragment(templateInstructions);

		new Setting(this.containerEl)
			.setName('Highlights template')
			.setDesc(templateDescFragment)
			.addTextArea((text) => {
				text.inputEl.style.width = '100%';
				text.inputEl.style.height = '450px';
				text.inputEl.style.fontSize = '0.8em';
				text.setValue(this.plugin.settings.template)
					.onChange(async (value) => {
						const isValid = this.renderer.validate(value);

						if (isValid) {
							this.plugin.settings.template = value;
							await this.plugin.saveSettings();
						}

						text.inputEl.style.border = isValid ? '' : '1px solid red';
					});
				return text;
			});
	}

	private resetSyncHistory(): void {
		new Setting(this.containerEl)
		  .setName('Reset sync')
		  .setDesc('Wipe sync history to resync')
		  .addButton((button) => {
			return button
				.setButtonText('Reset')
				// .setDisabled(!get(settingsStore).isConnected)
				.setWarning()
				.onClick(async () => {
					for (let id in this.plugin.settings.syncCollections) {
						const collection = this.plugin.settings.syncCollections[id];
						collection.lastSyncDate = undefined;
					}
					this.plugin.saveSettings();
					new Notice("Sync history has been reset");
			});
		});
	}

	private dateFormat(): void {
		const descFragment = document
		  .createRange()
		  .createContextualFragment(datetimeInstructions);
	
		new Setting(this.containerEl)
			.setName('Date & time format')
			.setDesc(descFragment)
			.addText((text) => {
				return text
					.setPlaceholder('YYYY-MM-DD HH:mm:ss')
					.setValue(this.plugin.settings.dateTimeFormat)
					.onChange(async (value) => {
					this.plugin.settings.dateTimeFormat = value;
					await this.plugin.saveSettings();
					});
			});
	}	
}
