import { App, Modal } from "obsidian";
import type RaindropPlugin from "src/main";
import type { SyncCollection } from "src/types";
import CollectionsContent from "../modal/collections.svelte";
import { mount, unmount } from "svelte";

export default class CollectionsModal extends Modal {
	private modalContent: ReturnType<typeof mount>;
	private plugin: RaindropPlugin;

	constructor(app: App, plugin: RaindropPlugin) {
		super(app);

		this.plugin = plugin;
		this.titleEl.innerText = "Raindrop.io: Manage collections to be synced";

		const collections: [string, SyncCollection][] = [];
		for (const [key, collection] of Object.entries(this.plugin.settings.syncCollections)) {
			if (collection) {
				collections.push([key, collection]);
			}
		}

		collections.sort((a: [string, SyncCollection], b: [string, SyncCollection]) => {
			return a[1].title.localeCompare(b[1].title);
		});

		this.modalContent = mount(CollectionsContent, {
			target: this.contentEl,
			props: {
				collections: collections,
				toggle: async (id: number) => {
					const targetCollection = this.plugin.settings.syncCollections[id];
					if (!targetCollection) {
						return;
					}
					targetCollection.sync = !targetCollection.sync;
					await this.plugin.saveSettings();
				},
			},
		});

		this.open();
	}

	onClose() {
		super.onClose();
		unmount(this.modalContent).catch((e) => {
			console.error("Error unmounting modal content", e);
		});
	}
}
