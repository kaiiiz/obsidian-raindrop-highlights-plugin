import type { App } from "obsidian";
import axios from "axios";
import type { RaindropArticle, RaindropCollection, RaindropHighlight } from "./types";
import type RaindropPlugin from "./main";

const BASEURL = "https://api.raindrop.io/rest/v1"

export class RaindropAPI {
	app: App;
	plugin: RaindropPlugin;

	constructor(app: App, plugin: RaindropPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	async get(url: string, params: any) {
		const token = this.plugin.settings.token;

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
		const res = await this.get(`${BASEURL}/collections`, {});

		const collections: RaindropCollection[] = res.items.map((collection: any) => {
			return {
				title: collection['title'],
				id: collection['_id'],
			};
		})

		return collections;
	}

	async getRaindropsAfter(collectionId: number, lastSync?: Date): Promise<RaindropArticle[]> {
		let res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
			"page": 0,
			"sort": "-lastUpdate"
		});
		let raindropsCnt = res.count;
		let articles = this.parseArticle(res.items);
		let remainPages = Math.ceil(raindropsCnt / 25) - 1;
		let page = 1;

		let addNewPages = async (page: number) => {
			let res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
				"page": page,
				"sort": "-lastUpdate"
			});
			articles = articles.concat(this.parseArticle(res.items));
		}

		if (lastSync === undefined) { // sync all
			while (remainPages--) {
				await addNewPages(page++);
			}
		} else { // sync article after lastSync
			while (articles[articles.length - 1].lastUpdate >= lastSync && remainPages--) {
				await addNewPages(page++);
			}
			articles = articles.filter(article => {
				return article.lastUpdate >= lastSync;
			})
		}

		return articles;
	}

	private parseArticle(articles: any): RaindropArticle[] {
		return articles.map((raindrop: any) => {
			return {
				id: raindrop['_id'],
				title: raindrop['title'],
				highlights: raindrop['highlights'].map((hl: any) => {
					return {
						color: hl['color'],
						text: hl['text'],
						lastUpdate: new Date(hl['lastUpdate']),
					} as RaindropHighlight;
				}),
				excerpt: raindrop['excerpt'],
				link: raindrop['link'],
				lastUpdate: new Date(raindrop['lastUpdate']),
			} as RaindropArticle;
		});
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
