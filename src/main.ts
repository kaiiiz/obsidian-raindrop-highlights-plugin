import { Notice, Plugin } from 'obsidian';
import { RaindropSettingTab } from './settings';
import RaindropSync from './sync';
import type { RaindropCollection, RaindropPluginSettings, SyncCollection, SyncCollectionSettings } from './types';
import { RaindropAPI } from './api';
import { VERSION, DEFAULT_SETTINGS } from './constants';
import BreakingChangeModal from './modal/breakingChange';
import CollectionsModal from './modal/collections';
import semver from "semver";

export default class RaindropPlugin extends Plugin {
	private raindropSync: RaindropSync;
	public settings: RaindropPluginSettings;
	public api: RaindropAPI;
	private timeoutIDAutoSync?: number;

	async onload() {
		await this.loadSettings();

		this.api = new RaindropAPI(this.app);
		this.raindropSync = new RaindropSync(this.app, this, this.api);

		if (this.settings.ribbonIcon) {
			this.addRibbonIcon('cloud', 'Sync your Raindrop highlights', () => {
				if (!this.settings.isConnected) {
					new Notice('Please configure Raindrop API token in the plugin setting');
				} else {
					this.raindropSync.sync();
				}
			});
		}

		this.addCommand({
			id: 'raindrop-sync',
			name: 'Sync highlights',
			callback: async () => {
				await this.raindropSync.sync();
			}
		});

		this.addCommand({
			id: 'raindrop-show-last-sync-time',
			name: 'Show last sync time',
			callback: async () => {
				const message = Object.values(this.settings.syncCollections)
					.filter((collection: SyncCollection) => collection.sync)
					.map((collection: SyncCollection) => {
						return `${collection.title}: ${collection.lastSyncDate?.toLocaleString()}`;
					})
					.join("\n");
				new Notice(message);
			}
		});

		this.addCommand({
			id: 'raindrop-open-link',
			name: 'Open link in Raindrop',
			callback: async () => {
				const file = app.workspace.getActiveFile();
				if (file) {
					const fmc = app.metadataCache.getFileCache(file)?.frontmatter;
					if (fmc?.raindrop_id) {
						const bookmark = await this.api.getRaindrop(fmc.raindrop_id);
						window.open(`https://app.raindrop.io/my/${bookmark.collectionId}/item/${bookmark.id}/edit`);
					} else {
						new Notice("This is not a Raindrop article file")
					}
				} else {
					new Notice("No active file");
				}
			}
		});

		this.addCommand({
			id: 'raindrop-manage-collection',
			name: 'Manage collections to be synced',
			callback: async () => {
				const notice = new Notice('Loading collections...');

				// update for new collections
				const collectionGroup = this.settings.collectionGroups;
				const allCollections = await this.api.getCollections(collectionGroup);
				this.updateCollectionSettings(allCollections);

				notice.hide();

				new CollectionsModal(this.app, this);
			}
		});

		this.addSettingTab(new RaindropSettingTab(this.app, this, this.api));

		if (this.settings.autoSyncInterval) {
			this.startAutoSync();
		}
	}

	async onunload() {
		await this.clearAutoSync();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		for (const id in this.settings.syncCollections) {
			const collection = this.settings.syncCollections[id];
			if (collection.lastSyncDate) {
				collection.lastSyncDate = new Date(collection.lastSyncDate);
			}
		}
		// version migration notice
		new BreakingChangeModal(this.app, this.settings.version);

		// setting migration
		if (semver.lt(this.settings.version, "0.0.18")) {
			if ('dateTimeFormat' in this.settings) {
				// @ts-expect-error
				delete this.settings['dateTimeFormat'];
			}
		}

		this.settings.version = VERSION;
		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async updateCollectionSettings(collections: RaindropCollection[]) {
		const syncCollections: SyncCollectionSettings = {};
		collections.forEach(async (collection) => {
			const {id, title} = collection;

			if (!(id in this.settings.syncCollections)) {
				syncCollections[id] = {
					id: id,
					title: title,
					sync: false,
					lastSyncDate: undefined,
				};
			} else {
				syncCollections[id] = this.settings.syncCollections[id];
				syncCollections[id].title = title;
			}
		});
		this.settings.syncCollections = syncCollections;
		await this.saveSettings();
	}

	async clearAutoSync(): Promise<void> {
		if (this.timeoutIDAutoSync) {
			window.clearTimeout(this.timeoutIDAutoSync);
			this.timeoutIDAutoSync = undefined;
		}
		console.info('Clearing auto sync...');
	}

	async startAutoSync(minutes?: number): Promise<void> {
		const minutesToSync = minutes ?? this.settings.autoSyncInterval;
		if (minutesToSync > 0) {
			this.timeoutIDAutoSync = window.setTimeout(
				() => {
					this.raindropSync.sync();
					this.startAutoSync();
				},
				minutesToSync * 60000
			);
		}
		console.info(`StartAutoSync: this.timeoutIDAutoSync ${this.timeoutIDAutoSync} with ${minutesToSync} minutes`);
	}
}
