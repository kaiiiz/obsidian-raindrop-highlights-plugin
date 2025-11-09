import type RaindropPlugin from "./main";
import type { RaindropCollection, SyncCollections } from "./types";

export class RaindropPluginSettings {
	private plugin: RaindropPlugin;

	constructor(plugin: RaindropPlugin) {
		this.plugin = plugin;
	}

	private flattenCollectionChain() {
		// key: collection id, value: parent category chain
		const collectionChainMap = new Map<number, number[]>();
		// key: collection id, value: parent category id
		const parentMap = new Map<number, number | undefined>();
		for (const collection of Object.values(this.plugin.settings.syncCollections)) {
			if (!collection) continue;
			parentMap.set(collection.id, collection.parentId);
		}
		for (const collection of Object.values(this.plugin.settings.syncCollections)) {
			if (!collection) continue;
			const collectionChain: number[] = [];
			let curParentId = collection.parentId;
			while (curParentId !== undefined) {
				collectionChain.push(curParentId);
				curParentId = parentMap.get(curParentId);
			}
			collectionChainMap.set(collection.id, collectionChain);
		}
		return collectionChainMap;
	}

	private async autoCheckNestedCollections() {
		if (!this.plugin.settings.autoSyncNewNestedCollections) {
			return;
		}

		const collectionChainMap = this.flattenCollectionChain();

		for (const [collectionId, parentIds] of collectionChainMap.entries()) {
			const targetCollection = this.plugin.settings.syncCollections[collectionId.toString()];
			if (!targetCollection) continue;
			// check this collection if any of its parent is checked
			for (const parentId of parentIds) {
				const parentCollection = this.plugin.settings.syncCollections[parentId.toString()];
				if (parentCollection?.sync) {
					targetCollection.sync = true;
					break;
				}
			}
		}
	}

	private async setAllCollections(sync: boolean) {
		for (const collection of Object.values(this.plugin.settings.syncCollections)) {
			if (!collection) continue;
			collection.sync = sync;
		}
	}

	private async setAllChildCollections(categoryId: number, sync: boolean) {
		const collectionChainMap = this.flattenCollectionChain();

		for (const [collectionId, parentIds] of collectionChainMap.entries()) {
			const targetCollection = this.plugin.settings.syncCollections[collectionId.toString()];
			if (!targetCollection) continue;
			// check this collection if its parent chain includes the given categoryId
			if (parentIds.includes(categoryId)) {
				targetCollection.sync = sync;
			}
		}
	}

	async updateCollectionSettings(collections: RaindropCollection[]) {
		const syncCollections: SyncCollections = {};
		for (const collection of collections) {
			const { id, title } = collection;
			const collectionKey = id.toString();
			const targetCollection = this.plugin.settings.syncCollections[collectionKey];
			const parentId = collection.parentId ? collection.parentId : undefined;

			if (targetCollection === undefined) {
				syncCollections[collectionKey] = {
					id: id,
					title: title,
					sync: false,
					lastSyncDate: undefined,
					parentId,
				};
			} else {
				syncCollections[collectionKey] = targetCollection;
				syncCollections[collectionKey].title = title;
				syncCollections[collectionKey].parentId = parentId;
			}
		}
		this.plugin.settings.syncCollections = syncCollections;
		if (this.plugin.settings.autoSyncAllCollections) {
			await this.setAllCollections(true);
		} else {
			await this.autoCheckNestedCollections();
		}
		await this.plugin.saveSettings();
	}

	async toggleSyncAllCollections() {
		const newValue = !this.plugin.settings.autoSyncAllCollections;
		this.plugin.settings.autoSyncAllCollections = newValue;

		await this.setAllCollections(newValue);
		await this.plugin.saveSettings();
	}

	async toggleAutoSyncNestedCollections() {
		const newValue = !this.plugin.settings.autoSyncNewNestedCollections;
		this.plugin.settings.autoSyncNewNestedCollections = newValue;

		await this.autoCheckNestedCollections();
		await this.plugin.saveSettings();
	}

	async toggleCollectionSync(id: string) {
		const targetCollection = this.plugin.settings.syncCollections[id];
		if (!targetCollection) {
			return;
		}
		targetCollection.sync = !targetCollection.sync;

		if (this.plugin.settings.autoSyncNewNestedCollections) {
			await this.setAllChildCollections(targetCollection.id, targetCollection.sync);
		}

		await this.plugin.saveSettings();
	}
}
