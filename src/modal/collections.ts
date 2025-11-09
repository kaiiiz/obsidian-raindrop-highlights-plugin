import { App, Modal } from "obsidian";
import { RaindropPluginSettings } from "src/settings";
import { SYSTEM_COLLECTIONS } from "src/constants";
import type RaindropPlugin from "src/main";
import type { SyncCollection } from "src/types";

export default class CollectionsModal extends Modal {
	private plugin: RaindropPlugin;
	private pluginSettings: RaindropPluginSettings;

	constructor(app: App, plugin: RaindropPlugin) {
		super(app);

		this.plugin = plugin;
		this.titleEl.innerText = "Raindrop.io: Manage collections to be synced";
		this.pluginSettings = new RaindropPluginSettings(plugin);

		this.rerender();
		this.open();
	}

	rerender() {
		this.contentEl.empty();

		const rootDiv = this.contentEl.createDiv();

		// render config
		const autoSyncAllColDiv = rootDiv.createDiv({ cls: "collection-entry" });
		const autoSyncAllColBtn = autoSyncAllColDiv.createEl("input", {
			type: "checkbox",
		});
		autoSyncAllColBtn.checked = this.plugin.settings.autoSyncAllCollections;
		autoSyncAllColBtn.onclick = async () => {
			await this.pluginSettings.toggleSyncAllCollections();
			this.rerender();
		};
		autoSyncAllColDiv.createEl("span", {
			text: "Auto sync all collections",
		});

		if (!this.plugin.settings.autoSyncAllCollections) {
			const autoSyncNestedColDiv = rootDiv.createDiv({ cls: "collection-entry" });
			const autoSyncNestedColInput = autoSyncNestedColDiv.createEl("input", {
				type: "checkbox",
			});
			autoSyncNestedColInput.checked = this.plugin.settings.autoSyncNewNestedCollections;
			autoSyncNestedColInput.onclick = async () => {
				await this.pluginSettings.toggleAutoSyncNestedCollections();
				this.rerender();
			};
			autoSyncNestedColDiv.createEl("span", {
				text: "Auto sync new nested collections",
			});
		}

		// render divider
		const divider = rootDiv.createEl("hr");
		divider.style.margin = "8px";

		// render collections
		const sysCollectionIdSet = new Set(SYSTEM_COLLECTIONS.map((col) => col.id));
		const sysCollections: [string, SyncCollection][] = [];
		const userCollections: [string, SyncCollection][] = [];

		for (const [key, collection] of Object.entries(this.plugin.settings.syncCollections)) {
			if (collection === undefined) continue;
			if (sysCollectionIdSet.has(collection.id)) {
				sysCollections.push([key, collection]);
			} else {
				userCollections.push([key, collection]);
			}
		}

		sysCollections.sort((a: [string, SyncCollection], b: [string, SyncCollection]) => {
			return a[1].title.localeCompare(b[1].title);
		});
		userCollections.sort((a: [string, SyncCollection], b: [string, SyncCollection]) => {
			return a[1].title.localeCompare(b[1].title);
		});

		const renderCollection = (collections: [string, SyncCollection][]) => {
			for (const [id, collection] of collections) {
				const entryDiv = rootDiv.createDiv({ cls: "collection-entry" });
				const checkbox = entryDiv.createEl("input", {
					type: "checkbox",
				});
				checkbox.disabled = this.plugin.settings.autoSyncAllCollections;
				checkbox.checked = collection.sync;
				checkbox.onclick = async () => {
					await this.pluginSettings.toggleCollectionSync(id);
					this.rerender();
				};
				entryDiv.createEl("span", {
					text: collection.title,
				});
			}
		};

		renderCollection(sysCollections);
		renderCollection(userCollections);
	}

	onClose() {
		super.onClose();
	}
}
