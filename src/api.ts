import type { App } from "obsidian";
import axios from "axios";
import type { RaindropArticle, RaindropCollection, RaindropHighlight, RaindropUser } from "./types";
import TokenManager from "./tokenManager";

const BASEURL = "https://api.raindrop.io/rest/v1"

export class RaindropAPI {
	app: App;
	tokenManager: TokenManager;

	constructor(app: App) {
		this.app = app;
		this.tokenManager = new TokenManager();
	}

	private async get(url: string, params: any) {
		const token = this.tokenManager.get();
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
		let articles = this.parseArticles(res.items);
		let remainPages = Math.ceil(raindropsCnt / 25) - 1;
		let page = 1;

		let addNewPages = async (page: number) => {
			let res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
				"page": page,
				"sort": "-lastUpdate"
			});
			articles = articles.concat(this.parseArticle(res.items));
		}

		if (articles.length > 0) {
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
		}

		// get real highlights (raindrop returns only 3 highlights in /raindrops/${collectionId} endpoint)
		for (let article of articles) {
			if (article.highlights.length == 3) {
				let res = await this.get(`${BASEURL}/raindrop/${article.id}`, {});
				article['highlights'] = this.parseHighlights(res.item.highlights);
			}
			// filter highlights by lastSync
			if (lastSync !== undefined) {
				article['highlights'] = article['highlights'].filter((hl) => {
					return hl.lastUpdate >= lastSync;
				})
			}
		}

		return articles;
	}

	async getUser(): Promise<RaindropUser> {
		const res = await this.get(`${BASEURL}/user`, {});
		return {
			fullName: res.user.fullName,
		};
	}

	async checkToken(token: string): Promise<RaindropUser> {
		let result;
		try {
			result = await axios.get(`${BASEURL}/user`, {
				headers: {
					"Authorization": `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			if (result.status !== 200) {
				throw new Error("Invalid token");
			}
		} catch(e) {
			throw new Error("Invalid token");
		}

		const user = result.data.user;
		return {
			fullName: user.fullName,
		};
	}

	async getArticle(id: number): Promise<RaindropArticle> {
		const res = await this.get(`${BASEURL}/raindrop/${id}`, {});
		const article = this.parseArticle(res.item);
		return article;
	}

	private parseArticles(articles: any): RaindropArticle[] {
		return articles.map((raindrop: any) => {
			return this.parseArticle(raindrop);
		});
	}

	private parseArticle(raindrop: any): RaindropArticle {
		const article: RaindropArticle = {
			id: raindrop['_id'],
			collectionId: raindrop['collectionId'],
			title: raindrop['title'],
			highlights: this.parseHighlights(raindrop['highlights']),
			excerpt: raindrop['excerpt'],
			link: raindrop['link'],
			lastUpdate: new Date(raindrop['lastUpdate']),
			tags: raindrop['tags'],
		};
		return article;
	}

	private parseHighlights(highlights: any): RaindropHighlight[] {
		return highlights.map((hl: any) => {
			const highlight: RaindropHighlight = {
				id: hl['_id'],
				color: hl['color'],
				text: hl['text'],
				lastUpdate: new Date(hl['lastUpdate']),
				created: new Date(hl['created']),
				note: hl['note'],
			};
			return highlight;
		});
	}
}
