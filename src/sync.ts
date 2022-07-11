import { App } from "obsidian";
import { RaindropAPI } from "./api";
import { TokenManager } from "./store/token";

class FileManager {

}

export default class RaindropSync {
	app: App;
	private fileManager: FileManager;
	private api: RaindropAPI;

	constructor(app: App, tokenManager: TokenManager) {
		this.app = app;
		this.fileManager = new FileManager();
		this.api = new RaindropAPI(app, tokenManager);
	}

	async sync() {

	}
}
