import { App } from "obsidian";

export class TokenManager {
    app: App;
	token: undefined|string;

	constructor(app: App) {
		this.app = app;
	}

	private getTokenPath(): string {
		return `.obsidian/raindrop-token`;
	}

	async getToken(): Promise<string> {
		if (this.token === undefined) {
			const token = await this.app.vault.adapter.read(this.getTokenPath());
			this.token = token;
		}
		return this.token;
	}

	async setToken(token: string): Promise<void> {
		await this.app.vault.adapter.write(this.getTokenPath(), token);
		this.token = token;
	}
}
