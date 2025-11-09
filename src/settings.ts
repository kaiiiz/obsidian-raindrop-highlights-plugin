import { Notice, type App } from "obsidian";
import { DEFAULT_SETTINGS, SYSTEM_COLLECTIONS, VERSION } from "./constants";
import type RaindropPlugin from "./main";
import BreadkingChangeModal from "./modal/breakingChange";
import {
	ZPluginSettings,
	type DeepReadonly,
	type RaindropCollection,
	type SyncCollection,
	type SyncCollections,
	type ZPluginSettingsType,
} from "./types";

import semver from "semver";

export class RaindropPluginSettings {
	private _app: App;
	private _plugin: RaindropPlugin;
	private _settings: ZPluginSettingsType;

	constructor(app: App, plugin: RaindropPlugin) {
		this._app = app;
		this._plugin = plugin;
		this._settings = DEFAULT_SETTINGS;
	}

	get enableRibbonIcon() {
		return this._settings.ribbonIcon;
	}

	async setEnableRibbonIcon(value: boolean) {
		this._settings.ribbonIcon = value;
		await this.save();
	}

	get enableAppendMode() {
		return this._settings.appendMode;
	}

	async setEnableAppendMode(value: boolean) {
		this._settings.appendMode = value;
		await this.save();
	}

	get onlySyncBookmarksWithHl() {
		return this._settings.onlyBookmarksWithHl;
	}

	async setOnlySyncBookmarksWithHl(value: boolean) {
		this._settings.onlyBookmarksWithHl = value;
		await this.save();
	}

	get enablePreventMovingExistingFiles() {
		return this._settings.preventMovingExistingFiles;
	}

	async setEnablePreventMovingExistingFiles(value: boolean) {
		this._settings.preventMovingExistingFiles = value;
		await this.save();
	}

	get enableCollectionsFolders() {
		return this._settings.collectionsFolders;
	}

	async setEnableCollectionsFolders(value: boolean) {
		this._settings.collectionsFolders = value;
		await this.save();
	}

	get isConnected() {
		return this._settings.isConnected;
	}

	get username() {
		return this._settings.username;
	}

	async setIsConnected(connected: boolean, userName: string | undefined) {
		this._settings.isConnected = connected;
		this._settings.username = userName;
		await this.save();
	}

	get highlightsFolder(): DeepReadonly<string> {
		return this._settings.highlightsFolder;
	}

	async setHighlightsFolder(path: string) {
		this._settings.highlightsFolder = path;
		await this.save();
	}

	get enableCollectionGroups() {
		return this._settings.collectionGroups;
	}

	async setEnableCollectionGroups(value: boolean) {
		this._settings.collectionGroups = value;
		await this.save();
	}

	get contentTemplate(): DeepReadonly<string> {
		return this._settings.template;
	}

	async setContentTemplate(template: string) {
		this._settings.template = template;
		await this.save();
	}

	get metadataTemplate(): DeepReadonly<string> {
		return this._settings.metadataTemplate;
	}

	async setMetadataTemplate(template: string) {
		this._settings.metadataTemplate = template;
		await this.save();
	}

	get filenameTemplate(): DeepReadonly<string> {
		return this._settings.filenameTemplate;
	}

	async setFilenameTemplate(template: string) {
		this._settings.filenameTemplate = template;
		await this.save();
	}

	get syncCollectionsList(): DeepReadonly<SyncCollection[]> {
		return Object.values(this._settings.syncCollections);
	}

	get syncCollections(): DeepReadonly<SyncCollections> {
		return this._settings.syncCollections;
	}

	get syncCollectionsSeparated(): {
		sysCollections: [string, DeepReadonly<SyncCollection>][];
		userCollections: [string, DeepReadonly<SyncCollection>][];
	} {
		const sysCollectionIdSet = new Set(SYSTEM_COLLECTIONS.map((col) => col.id));
		const sysCollections: [string, DeepReadonly<SyncCollection>][] = [];
		const userCollections: [string, DeepReadonly<SyncCollection>][] = [];

		for (const [key, collection] of Object.entries(this._settings.syncCollections)) {
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

		return { sysCollections, userCollections };
	}

	async setSyncCollections(collections: RaindropCollection[]) {
		const syncCollections: SyncCollections = {};
		for (const collection of collections) {
			const { id, title } = collection;
			const collectionKey = id.toString();
			const targetCollection = this._settings.syncCollections[collectionKey];
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
				targetCollection.title = title;
				targetCollection.parentId = parentId;
				syncCollections[collectionKey] = targetCollection;
			}
		}
		this._settings.syncCollections = syncCollections;
		if (this._settings.autoSyncAllCollections) {
			await this.setAllCollections(true);
		} else {
			await this.autoCheckNestedCollections();
		}
		await this.save();
	}

	async toggleCollectionSync(id: string) {
		const targetCollection = this._settings.syncCollections[id];
		if (!targetCollection) {
			return;
		}
		targetCollection.sync = !targetCollection.sync;

		if (this._settings.autoSyncNewNestedCollections) {
			await this.setAllChildCollections(targetCollection.id, targetCollection.sync);
		}

		await this.save();
	}

	async resetAllCollectionSyncHistory() {
		for (const collection of Object.values(this._settings.syncCollections)) {
			collection.lastSyncDate = undefined;
		}
		await this.save();
	}

	async updateCollectionLastSyncDate(id: string, date: Date) {
		const targetCollection = this._settings.syncCollections[id];
		if (!targetCollection) {
			return;
		}
		targetCollection.lastSyncDate = date;
		await this.save();
	}

	get autoSyncInterval() {
		return this._settings.autoSyncInterval;
	}

	async setAutoSyncInterval(minutes: number) {
		this._settings.autoSyncInterval = minutes;
		await this.save();
	}

	get enableSyncNotices() {
		return this._settings.autoSyncSuccessNotice;
	}

	async setEnableSyncNotices(value: boolean) {
		this._settings.autoSyncSuccessNotice = value;
		await this.save();
	}

	get enableAutoEscape() {
		return this._settings.autoescape;
	}

	async setEnableAutoEscape(value: boolean) {
		this._settings.autoescape = value;
		await this.save();
	}

	get enableAutoSyncAllCollections() {
		return this._settings.autoSyncAllCollections;
	}

	async toggleSyncAllCollections() {
		const newValue = !this._settings.autoSyncAllCollections;
		this._settings.autoSyncAllCollections = newValue;

		await this.setAllCollections(newValue);
		await this.save();
	}

	get enableAutoSyncNewNestedCollections() {
		return this._settings.autoSyncNewNestedCollections;
	}

	async toggleAutoSyncNestedCollections() {
		const newValue = !this._settings.autoSyncNewNestedCollections;
		this._settings.autoSyncNewNestedCollections = newValue;

		await this.autoCheckNestedCollections();
		await this.save();
	}

	getSyncCollectionById(id: string): DeepReadonly<SyncCollection | undefined> {
		return this._settings.syncCollections[id];
	}

	private async migrateSettings() {
		// do not use zod here for compatibility reasons
		this._settings = Object.assign({}, DEFAULT_SETTINGS, await this._plugin.loadData());
		if (semver.eq(this._settings.version, VERSION)) {
			return;
		}

		// setting migration
		if (semver.lt(this._settings.version, "0.0.18")) {
			if ("dateTimeFormat" in this._settings) {
				delete this._settings["dateTimeFormat"];
			}
		}

		// version migration notice
		new BreadkingChangeModal(this._app, this._settings.version);

		this._settings.version = VERSION;

		await this.save();
	}

	async load() {
		await this.migrateSettings();

		const safedSettings = ZPluginSettings.safeParse(await this._plugin.loadData());
		if (!safedSettings.success) {
			new Notice("Raindrop Highlight: Settings are corrupted. Resetting to default.");
			this._settings = DEFAULT_SETTINGS;
			await this.save();
		} else {
			this._settings = safedSettings.data;
		}
	}

	private async save() {
		await this._plugin.saveData(this._settings);
	}

	private flattenCollectionChain() {
		// key: collection id, value: parent category chain
		const collectionChainMap = new Map<number, number[]>();
		// key: collection id, value: parent category id
		const parentMap = new Map<number, number | undefined>();
		for (const collection of this.syncCollectionsList) {
			parentMap.set(collection.id, collection.parentId);
		}
		for (const collection of this.syncCollectionsList) {
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
		if (!this._settings.autoSyncNewNestedCollections) {
			return;
		}

		const collectionChainMap = this.flattenCollectionChain();

		for (const [collectionId, parentIds] of collectionChainMap.entries()) {
			const targetCollection = this._settings.syncCollections[collectionId.toString()];
			if (!targetCollection) continue;
			// check this collection if any of its parent is checked
			for (const parentId of parentIds) {
				const parentCollection = this._settings.syncCollections[parentId.toString()];
				if (parentCollection?.sync) {
					targetCollection.sync = true;
					break;
				}
			}
		}
	}

	private async setAllCollections(sync: boolean) {
		const sysCollectionIdSet = new Set(SYSTEM_COLLECTIONS.map((col) => col.id));

		for (const [, collection] of Object.entries(this._settings.syncCollections)) {
			if (sysCollectionIdSet.has(collection.id)) {
				continue;
			}
			collection.sync = sync;
		}
	}

	private async setAllChildCollections(categoryId: number, sync: boolean) {
		const collectionChainMap = this.flattenCollectionChain();

		for (const [collectionId, parentIds] of collectionChainMap.entries()) {
			const targetCollection = this._settings.syncCollections[collectionId.toString()];
			if (!targetCollection) continue;
			// check this collection if its parent chain includes the given categoryId
			if (parentIds.includes(categoryId)) {
				targetCollection.sync = sync;
			}
		}
	}
}
