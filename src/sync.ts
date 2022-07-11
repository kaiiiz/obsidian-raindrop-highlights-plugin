import { App, Notice } from "obsidian";
import { RaindropAPI } from "./api";
import type RaindropPlugin from "./main";

export default class RaindropSync {
	private app: App;
	private plugin: RaindropPlugin;
	private api: RaindropAPI;

	constructor(app: App, plugin: RaindropPlugin) {
		this.app = app;
		this.plugin = plugin;
		this.api = new RaindropAPI(app, plugin);
	}

	async sync() {

		// const highlightsFolder = this.plugin.settings.highlightsFolder;
		// try {
		// 	await this.app.vault.createFolder(`${highlightsFolder}/${collection['title']}`);
		// } catch (e) {
		// 	/* ignore folder already exists error */
		// }

		try {
			await this.api.getRaindropsAfter(this.plugin.settings.lastSyncDate);
		} catch (e) {
			new Notice(`Raindrop Sync Failed: ${e.message}`);
		}
	}

	async syncComplete() {
		this.plugin.settings.lastSyncDate = new Date();
		await this.plugin.saveSettings();
	}
}
