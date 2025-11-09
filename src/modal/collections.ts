import { App, Modal } from "obsidian";
import type RaindropPlugin from "src/main";
import type { SyncCollection } from "src/types";

export default class CollectionsModal extends Modal {
	private plugin: RaindropPlugin;

	constructor(app: App, plugin: RaindropPlugin) {
		super(app);

		this.plugin = plugin;
		this.titleEl.innerText = "Raindrop.io: Manage collections to be synced";

		this.rerender();
		this.open();
	}

	async toggleSyncAllCollections() {
		const newValue = !this.plugin.settings.autoCheckAllCollectionsOnSync;
		this.plugin.settings.autoCheckAllCollectionsOnSync = newValue;

		await this.plugin.setAllCollections(newValue);
		await this.plugin.saveSettings();

		this.rerender();
	}

	async toggleAutoCheckNestedCollectionOnSync() {
		const newValue = !this.plugin.settings.autoCheckNestedCollectionsOnSync;
		this.plugin.settings.autoCheckNestedCollectionsOnSync = newValue;

		await this.plugin.autoCheckNestedCollections();
		await this.plugin.saveSettings();

		this.rerender();
	}

	async toggleCollectionSync(id: string) {
		const targetCollection = this.plugin.settings.syncCollections[id];
		if (!targetCollection) {
			return;
		}
		targetCollection.sync = !targetCollection.sync;

		if (this.plugin.settings.autoCheckNestedCollectionsOnSync) {
			await this.plugin.setAllChildCollections(targetCollection.id, targetCollection.sync);
		}

		await this.plugin.saveSettings();

		this.rerender();
	}

	rerender() {
		const collections: [string, SyncCollection][] = [];

		this.contentEl.empty();

		const rootDiv = this.contentEl.createDiv();

		// render config
		const toggleAllDiv = rootDiv.createDiv({ cls: "collection-entry" });
		const toggleAllBtn = toggleAllDiv.createEl("input", {
			type: "checkbox",
		});
		toggleAllBtn.checked = this.plugin.settings.autoCheckAllCollectionsOnSync;
		toggleAllBtn.onclick = async () => {
			await this.toggleSyncAllCollections();
		};
		toggleAllDiv.createEl("span", {
			text: "Auto check all collections on sync",
		});

		if (!this.plugin.settings.autoCheckAllCollectionsOnSync) {
			const autoCheckNestedColDiv = rootDiv.createDiv({ cls: "collection-entry" });
			const autoCheckNestedColInput = autoCheckNestedColDiv.createEl("input", {
				type: "checkbox",
			});
			autoCheckNestedColInput.checked = this.plugin.settings.autoCheckNestedCollectionsOnSync;
			autoCheckNestedColInput.onclick = async () => {
				await this.toggleAutoCheckNestedCollectionOnSync();
			};
			autoCheckNestedColDiv.createEl("span", {
				text: "Auto check new nested collections on sync",
			});
		}

		// render divider
		const divider = rootDiv.createEl("hr");
		divider.style.margin = "8px";

		// render collections
		for (const [key, collection] of Object.entries(this.plugin.settings.syncCollections)) {
			if (collection) {
				collections.push([key, collection]);
			}
		}

		collections.sort((a: [string, SyncCollection], b: [string, SyncCollection]) => {
			return a[1].title.localeCompare(b[1].title);
		});

		for (const [id, collection] of collections) {
			const entryDiv = rootDiv.createDiv({ cls: "collection-entry" });
			const checkbox = entryDiv.createEl("input", {
				type: "checkbox",
			});
			checkbox.disabled = this.plugin.settings.autoCheckAllCollectionsOnSync;
			checkbox.checked = collection.sync;
			checkbox.onclick = async () => {
				await this.toggleCollectionSync(id);
			};
			entryDiv.createEl("span", {
				text: collection.title,
			});
		}
	}

	onClose() {
		super.onClose();
	}
}
