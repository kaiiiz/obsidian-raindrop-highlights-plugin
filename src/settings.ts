import {App, Notice, PluginSettingTab, Setting} from 'obsidian';
import templateInstructions from './templates/templateInstructions.html';
import tokenInstructions from './templates/tokenInstructions.html';
import { RaindropAPI } from 'src/api';
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
		this.template();
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
					const syncCollections = this.plugin.settings.syncCollections;
					allCollections.forEach(async (collection) => {
						const {id} = collection;

						if (!(id in syncCollections)) {
							syncCollections[id] = {
								...collection,
								sync: false,
							}
						}
					});
					await this.plugin.saveSettings();

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
}
