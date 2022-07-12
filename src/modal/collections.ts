import { App, Modal } from "obsidian";
import type RaindropPlugin from "src/main";
import CollectionsContent from '../modal/collections.svelte';

export default class CollectionsModal extends Modal {
	private modalContent: CollectionsContent;
	private plugin: RaindropPlugin;

	constructor(app: App, plugin: RaindropPlugin) {
		super(app);
		this.plugin = plugin;
		this.open();
	}

	async onOpen() {
		super.onOpen()

		this.titleEl.innerText = "Raindrop.io: Manage collections to be synced";

		this.modalContent = new CollectionsContent({
			target: this.contentEl,
			props: {
				collections: this.plugin.settings.syncCollections,
				toggle: async (id: number) => {
					this.plugin.settings.syncCollections[id].sync = !this.plugin.settings.syncCollections[id].sync;
					await this.plugin.saveSettings();
				}
			},
		});
	}

	onClose() {
		super.onClose();
		this.modalContent.$destroy();
	}
}
