import { App, Modal } from "obsidian";
import type RaindropPlugin from "src/main";
import type { SyncCollection } from "src/types";

export default class CollectionsModal extends Modal {
	private plugin: RaindropPlugin;
	private toggleAllBtnDirection: boolean = true;

	constructor(app: App, plugin: RaindropPlugin) {
		super(app);

		this.plugin = plugin;
		this.titleEl.innerText = "Raindrop.io: Manage collections to be synced";

		this.rerender();
		this.open();
	}

	async toggleAllCollections() {
		for (const collection of Object.values(this.plugin.settings.syncCollections)) {
			if (!collection) continue;
			collection.sync = this.toggleAllBtnDirection;
		}

		this.toggleAllBtnDirection = !this.toggleAllBtnDirection;
		await this.plugin.saveSettings();

		this.rerender();
	}

	async toggleAutoCheckNestedCollectionOnSync() {
		const newValue = !this.plugin.settings.autoCheckNestedCollectionOnSync;
		this.plugin.settings.autoCheckNestedCollectionOnSync = newValue;

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

		if (this.plugin.settings.autoCheckNestedCollectionOnSync) {
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
			type: "button",
		});
		toggleAllBtn.value = `${this.toggleAllBtnDirection ? "Check" : "Uncheck"} all collections`;
		toggleAllBtn.onclick = async () => {
			await this.toggleAllCollections();
		};
		toggleAllBtn.style.marginBottom = "8px";

		const autoCheckNestedColDiv = rootDiv.createDiv({ cls: "collection-entry" });
		const autoCheckNestedColInput = autoCheckNestedColDiv.createEl("input", {
			type: "checkbox",
		});
		autoCheckNestedColInput.checked = this.plugin.settings.autoCheckNestedCollectionOnSync;
		autoCheckNestedColInput.onclick = async () => {
			await this.toggleAutoCheckNestedCollectionOnSync();
		};
		autoCheckNestedColDiv.createEl("span", {
			text: "Auto check new nested collections on sync",
		});

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
