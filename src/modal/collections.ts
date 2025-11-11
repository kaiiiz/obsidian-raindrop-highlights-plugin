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

	rerender() {
		this.contentEl.empty();

		const rootDiv = this.contentEl.createDiv();

		// render config
		const autoSyncAllColDiv = rootDiv.createDiv({ cls: "collection-entry" });
		const autoSyncAllColBtn = autoSyncAllColDiv.createEl("input", {
			type: "checkbox",
		});
		autoSyncAllColBtn.checked = this.plugin.settings.enableAutoSyncAllCollections;
		autoSyncAllColBtn.onclick = async () => {
			await this.plugin.settings.toggleSyncAllCollections();
			this.rerender();
		};
		autoSyncAllColDiv.createEl("span", {
			text: "Auto sync all collections",
		});

		if (!this.plugin.settings.enableAutoSyncAllCollections) {
			const autoSyncNestedColDiv = rootDiv.createDiv({ cls: "collection-entry" });
			const autoSyncNestedColInput = autoSyncNestedColDiv.createEl("input", {
				type: "checkbox",
			});
			autoSyncNestedColInput.checked =
				this.plugin.settings.enableAutoSyncNewNestedCollections;
			autoSyncNestedColInput.onclick = async () => {
				await this.plugin.settings.toggleAutoSyncNestedCollections();
				this.rerender();
			};
			autoSyncNestedColDiv.createEl("span", {
				text: "Auto sync new nested collections",
			});
		}

		// render divider
		const divider = rootDiv.createEl("hr");
		divider.style.marginTop = "8px";
		divider.style.marginBottom = "8px";

		// render collections
		const { sysCollections, userCollections } = this.plugin.settings.syncCollectionsSeparated;

		const renderCollection = (collections: [string, SyncCollection][], isSysCol: boolean) => {
			const table = rootDiv.createEl("table");

			for (const [id, collection] of collections) {
				const row = table.createEl("tr");

				const checkboxTd = row.createEl("td");
				const entryDiv = checkboxTd.createDiv({ cls: "collection-entry" });
				const checkbox = entryDiv.createEl("input", {
					type: "checkbox",
				});
				if (!isSysCol) {
					checkbox.disabled = this.plugin.settings.enableAutoSyncAllCollections;
				}
				checkbox.checked = collection.sync;
				checkbox.onclick = async () => {
					await this.plugin.settings.toggleCollectionSync(id);
					this.rerender();
				};
				entryDiv.createEl("span", {
					text: collection.title,
				});

				const inputTd = row.createEl("td");
				const searchInput = inputTd.createEl("input");
				searchInput.placeholder = "Search";
				searchInput.value = collection.search ?? "";
				searchInput.onchange = async (event) => {
					const value = (event.target as HTMLInputElement).value;
					await this.plugin.settings.setCollectionSearch(id, value);
					this.rerender();
				};
			}
		};

		const sysNoticeDiv = rootDiv.createEl("div", { cls: "collection-notice" });
		const sysNoticeP = sysNoticeDiv.createEl("span");
		sysNoticeP.innerHTML =
			"NOTICE: Each bookmark belongs to its original collection and a special system collection called <b>All Bookmarks</b>. Syncing both can cause conflicts — the bookmark's state will follow the most recently synced collection.";

		const searchNoticeDiv = rootDiv.createEl("div", { cls: "collection-notice" });
		const searchNoticeP = searchNoticeDiv.createEl("span");
		searchNoticeP.innerHTML =
			"NOTICE: Search syntax follows the <a href='https://help.raindrop.io/using-search#operators'>Raindrop.io documents</a>.";
		renderCollection(sysCollections, true);
		const divider2 = rootDiv.createEl("hr");
		divider2.style.marginTop = "8px";
		divider2.style.marginBottom = "8px";
		renderCollection(userCollections, false);
	}

	onClose() {
		super.onClose();
	}
}
