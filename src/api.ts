import type { App } from "obsidian";
import type { TokenManager } from "./store/token";
import axios from "axios";
import type { RaindropCollection } from "./types";

export class RaindropAPI {
	app: App;
	private tokenManager: TokenManager;

	constructor(app: App, tokenManager: TokenManager) {
		this.app = app;
		this.tokenManager = tokenManager;
	}

	async get(url: string, params: any) {
		const token = await this.tokenManager.getToken();

		if (!token) {
			throw new Error("Invalid token");
		}

		const result = await axios.get(url, {
			params: params,
			headers: {
				"Authorization": `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (result.status == 401) {
			throw new Error("Unauthorized");
		}

		if (result.status !== 200) {
			console.error("Raindrop API request failed:", result);
			throw new Error("Request failed");
		}

		return result.data;
	}

	async getCollections(): Promise<RaindropCollection[]> {
		const res = await this.get("https://api.raindrop.io/rest/v1/collections", {});

		const collections: RaindropCollection[] = res.items.map((collection: any) => {
			return {
				title: collection['title'],
				id: collection['_id'],
				lastUpdate: new Date(collection['lastUpdate']),
			}
		})

		return collections;
	}

	async getRaindropsAfter(lastSync?: Date) {
		if (lastSync == undefined) { // sync all
			
		}

		const raindrops = await this.get("https://api.raindrop.io/rest/v1/raindrops/0", {
			"page": 0,
			"sort": "-lastUpdate"
		});
		// TODO: handle pagination
		console.log(raindrops);
	}

	// async checkToken(token: string): Promise<RaindropUser> {
	// 	const result = await fetch("https://api.raindrop.io/rest/v1/user", {
	// 		method: "GET",
	// 		headers: new Headers({
	// 			Authorization: `Bearer ${token}`,
	// 			"Content-Type": "application/json",
	// 		}),
	// 	});

	// 	if (!result.ok) {
	// 		throw new Error("Invalid token");
	// 	}

	// 	const user = (await result.json()).user;
	// 	return {
	// 		fullName: user.fullName,
	// 	}
	// }
}
