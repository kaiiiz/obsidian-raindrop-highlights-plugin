import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import DEFAULT_METADATA_TEMPLATE from "./assets/defaultMetadataTemplate.njk";
import templateInstructions from "./templates/templateInstructions.html";
import metadataTemplateInstructions from "./templates/metadataTemplateInstructions.html";
import filenameTemplateInstructions from "./templates/filenameTemplateInstructions.html";
import collectionGroupsInstructions from "./templates/collectionGroupsInstructions.html";
import appendModeInstructions from "./templates/appendModeInstructions.html";
import autoescapingInstructions from "./templates/autoescapingInstructions.html";
import type { RaindropAPI } from "./api";
import type RaindropPlugin from "./main";
import CollectionsModal from "./modal/collections";
import Renderer from "./renderer";
import ApiTokenModal from "./modal/apiTokenModal";
import RaindropSync from "./sync";

export class RaindropSettingTab extends PluginSettingTab {
	private plugin: RaindropPlugin;
	private api: RaindropAPI;
	private renderer: Renderer;
	private raindropSync: RaindropSync;

	constructor(app: App, plugin: RaindropPlugin, api: RaindropAPI) {
		super(app, plugin);
		this.plugin = plugin;
		this.renderer = new Renderer(plugin);
		this.api = api;
		this.raindropSync = new RaindropSync(this.app, plugin, api);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		if (this.plugin.settings.isConnected) {
			this.disconnect();
		} else {
			this.connect();
		}
		new Setting(containerEl).setName("Plugin").setHeading();
		this.ribbonIcon();
		this.autoSyncInterval();
		this.autoSyncSuccessNotice();
		new Setting(containerEl).setName("Rules & Templates").setHeading();
		this.collections();
		this.onlyBookmarksWithHl();
		this.appendMode();
		this.template();
		this.metadataTemplate();
		this.highlightsFolder();
		this.collectionsFolders();
		this.collectionGroups();
		this.preventMovingExistingFiles();
		this.filenameTemplate();
		this.autoescape();
		new Setting(containerEl).setName("Maintenance").setHeading();
		this.resetSyncHistory();
	}

	private ribbonIcon(): void {
		new Setting(this.containerEl)
			.setName("Enable ribbon icon in the sidebar (need reload)")
			.addToggle((toggle) => {
				return toggle.setValue(this.plugin.settings.ribbonIcon).onChange(async (value) => {
					this.plugin.settings.ribbonIcon = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private appendMode(): void {
		const descFragment = document
			.createRange()
			.createContextualFragment(appendModeInstructions);

		new Setting(this.containerEl)
			.setName("Append Mode")
			.setDesc(descFragment)
			.addToggle((toggle) => {
				return toggle.setValue(this.plugin.settings.appendMode).onChange(async (value) => {
					this.plugin.settings.appendMode = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private onlyBookmarksWithHl(): void {
		new Setting(this.containerEl)
			.setName("Only sync bookmarks with highlights")
			.addToggle((toggle) => {
				return toggle
					.setValue(this.plugin.settings.onlyBookmarksWithHl)
					.onChange(async (value) => {
						this.plugin.settings.onlyBookmarksWithHl = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private preventMovingExistingFiles(): void {
		new Setting(this.containerEl)
			.setName("Folder location: Prevent moving existing files on sync")
			.setDesc("If enabled, existing files will not be moved during sync.")
			.addToggle((toggle) => {
				return toggle
					.setValue(this.plugin.settings.preventMovingExistingFiles)
					.onChange(async (value) => {
						this.plugin.settings.preventMovingExistingFiles = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private collectionsFolders(): void {
		new Setting(this.containerEl)
			.setName("Folder location: Collections folders")
			.setDesc("Organize highlights into folders based on their collections")
			.addToggle((toggle) => {
				return toggle
					.setValue(this.plugin.settings.collectionsFolders)
					.onChange(async (value) => {
						this.plugin.settings.collectionsFolders = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private connect(): void {
		new Setting(this.containerEl).setName("Connect to Raindrop.io").addButton((button) => {
			return button
				.setButtonText("Connect")
				.setCta()
				.onClick(async () => {
					const tokenModal = new ApiTokenModal(this.app, this.api);
					await tokenModal.waitForClose;

					if (this.api.tokenManager.get()) {
						new Notice("Token saved");
						const user = await this.api.getUser();
						this.plugin.settings.isConnected = true;
						this.plugin.settings.username = user.fullName;
						await this.plugin.saveSettings();
					}

					this.display(); // rerender
				});
		});
	}

	private disconnect() {
		new Setting(this.containerEl)
			.setName(`Connected to Raindrop.io as ${this.plugin.settings.username}`)
			.addButton((button) => {
				return button
					.setButtonText("Test API")
					.setCta()
					.onClick(async () => {
						try {
							const user = await this.api.getUser();
							new Notice(`Test pass, hello ${user.fullName}`);
						} catch (e) {
							console.error(e);
							new Notice(`Test failed: ${e}`);
							this.api.tokenManager.clear();
							this.plugin.settings.isConnected = false;
							this.plugin.settings.username = undefined;
							await this.plugin.saveSettings();
						}
					});
			})
			.addButton((button) => {
				return button
					.setButtonText("Disconnect")
					.setCta()
					.onClick(async () => {
						button.removeCta().setButtonText("Removing API token...").setDisabled(true);

						try {
							this.api.tokenManager.clear();
							this.plugin.settings.isConnected = false;
							this.plugin.settings.username = undefined;
							await this.plugin.saveSettings();
						} catch (e) {
							console.error(e);
							new Notice(`Token removed failed: ${e}`);
							return;
						}

						new Notice("Token removed successfully");
						this.display(); // rerender
					});
			});
	}

	private highlightsFolder(): void {
		new Setting(this.containerEl)
			.setName("Folder location")
			.setDesc("Vault folder to store highlights")
			.addDropdown((dropdown) => {
				const folders = this.app.vault.getAllFolders();
				for (const folder of folders) {
					dropdown.addOption(folder.path, folder.path);
				}
				return dropdown
					.setValue(this.plugin.settings.highlightsFolder)
					.onChange(async (value) => {
						this.plugin.settings.highlightsFolder = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private collectionGroups(): void {
		const descFragment = document
			.createRange()
			.createContextualFragment(collectionGroupsInstructions);

		new Setting(this.containerEl)
			.setName("Folder location: Collection groups")
			.setDesc(descFragment)
			.addToggle((toggle) => {
				return toggle
					.setValue(this.plugin.settings.collectionGroups)
					.onChange(async (value) => {
						this.plugin.settings.collectionGroups = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private collections(): void {
		new Setting(this.containerEl)
			.setName("Collections")
			.setDesc("Manage collections to be synced")
			.addButton((button) => {
				return button
					.setDisabled(!this.plugin.settings.isConnected)
					.setButtonText("Manage")
					.setCta()
					.onClick(async () => {
						button.setButtonText("Loading collections...");

						await this.raindropSync.syncCollectionMeta();

						new CollectionsModal(this.app, this.plugin);
						this.display(); // rerender
					});
			});
	}

	private template(): void {
		const templateDescFragment = document
			.createRange()
			.createContextualFragment(templateInstructions);

		new Setting(this.containerEl)
			.setName("Content template")
			.setDesc(templateDescFragment)
			.setClass("raindrop-content-template")
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.template).onChange(async (value) => {
					const isValid = this.renderer.validate(value);

					if (isValid) {
						this.plugin.settings.template = value;
						await this.plugin.saveSettings();
					}

					text.inputEl.style.border = isValid ? "" : "1px solid red";
				});
				return text;
			});
	}

	private metadataTemplate(): void {
		const templateDescFragment = document
			.createRange()
			.createContextualFragment(metadataTemplateInstructions);

		new Setting(this.containerEl)
			.setName("Metadata template")
			.setDesc(templateDescFragment)
			.setClass("raindrop-metadata-template")
			.addTextArea((text) => {
				text.setPlaceholder(DEFAULT_METADATA_TEMPLATE);
				text.setValue(this.plugin.settings.metadataTemplate).onChange(async (value) => {
					const isValid = this.renderer.validate(value, true);

					if (isValid) {
						this.plugin.settings.metadataTemplate = value;
						await this.plugin.saveSettings();
					}

					text.inputEl.style.border = isValid ? "" : "1px solid red";
				});
				return text;
			});
	}

	private filenameTemplate(): void {
		const templateDescFragment = document
			.createRange()
			.createContextualFragment(filenameTemplateInstructions);

		new Setting(this.containerEl)
			.setName("Filename template")
			.setDesc(templateDescFragment)
			.setClass("raindrop-filename-template")
			.addTextArea((text) => {
				text.setValue(this.plugin.settings.filenameTemplate).onChange(async (value) => {
					const isValid = this.renderer.validate(value, false);

					if (isValid) {
						this.plugin.settings.filenameTemplate = value;
						await this.plugin.saveSettings();
					}

					text.inputEl.style.border = isValid ? "" : "1px solid red";
				});
				return text;
			});
	}

	private resetSyncHistory(): void {
		new Setting(this.containerEl)
			.setName("Reset last sync time for all collections")
			.setDesc("This is useful if you want to resync all bookmarks.")
			.addButton((button) => {
				return button
					.setButtonText("Reset")
					.setDisabled(!this.plugin.settings.isConnected)
					.setWarning()
					.onClick(async () => {
						for (const collection of Object.values(
							this.plugin.settings.syncCollections,
						)) {
							if (collection === undefined) {
								continue;
							}
							collection.lastSyncDate = undefined;
						}
						await this.plugin.saveSettings();
						new Notice("Sync history reset successfully");
					});
			});
	}

	private autoSyncInterval(): void {
		new Setting(this.containerEl)
			.setName("Auto sync in interval (minutes)")
			.setDesc(
				"Sync every X minutes. To disable auto sync, specify negative value or zero (default)",
			)
			.addText((text) => {
				text.setPlaceholder(String(0))
					.setValue(this.plugin.settings.autoSyncInterval.toString())
					.onChange(async (value) => {
						if (!isNaN(Number(value))) {
							const minutes = Number(value);
							this.plugin.settings.autoSyncInterval = minutes;
							await this.plugin.saveSettings();
							console.info("Set raindrop.io autosync interval", minutes);
							if (minutes > 0) {
								this.plugin.clearAutoSync();
								await this.plugin.startAutoSync(minutes);
								console.info(
									`Raindrop.io auto sync enabled! Every ${minutes} minutes.`,
								);
							} else {
								this.plugin.clearAutoSync();
								console.info("Raindrop.io auto sync disabled!");
							}
						}
					});
			});
	}

	private autoSyncSuccessNotice(): void {
		new Setting(this.containerEl)
			.setName("Display a notification when a collection is synced")
			.addToggle((toggle) => {
				return toggle
					.setValue(this.plugin.settings.autoSyncSuccessNotice)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncSuccessNotice = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private autoescape(): void {
		const templateDescFragment = document
			.createRange()
			.createContextualFragment(autoescapingInstructions);

		new Setting(this.containerEl)
			.setName("Enable autoescaping for nunjucks")
			.setDesc(templateDescFragment)
			.addToggle((toggle) => {
				return toggle.setValue(this.plugin.settings.autoescape).onChange(async (value) => {
					this.plugin.settings.autoescape = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
