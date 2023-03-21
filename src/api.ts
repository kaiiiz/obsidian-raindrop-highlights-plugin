import { Notice, type App } from "obsidian";
import axios from "axios";
import type { RaindropBookmark, RaindropCollection, RaindropHighlight, RaindropUser } from "./types";
import TokenManager from "./tokenManager";

const BASEURL = "https://api.raindrop.io/rest/v1";

interface NestedRaindropCollection {
	title: string,
	parentId: number,
}

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
		let res = await this.get(`${BASEURL}/collections`, {});

		let collections: RaindropCollection[] = [
			{ id: -1, title: 'Unsorted' },
			{ id: -99, title: 'Trash' },
		];

		const rootCollectionMap: {[id: number]: string} = {};
		res.items.forEach((collection: any) => {
			const id = collection['_id'];
			const title = collection['title'];
			rootCollectionMap[id] = title;
			collections.push({
				title: title,
				id: id,
			});
		});

		res = await this.get(`${BASEURL}/collections/childrens`, {});
		const nestedCollectionMap: {[id: number]: NestedRaindropCollection} = {};
		res.items.forEach((collection: any) => {
			const id = collection['_id'];
			nestedCollectionMap[id] = {
				title: collection['title'],
				parentId: collection['parent']['$id'],
			};
		});

		res.items.forEach((collection: any) => {
			const id = collection['_id'];
			let parentId = collection['parent']['$id'];
			let title = collection['title'];
			while (!(parentId in rootCollectionMap)) {
				title = `${nestedCollectionMap[parentId].title}/${title}`;
				parentId = nestedCollectionMap[parentId].parentId;
			}
			collections.push({
				title: title,
				id: id,
			});
		});

		return collections;
	}

	async getRaindropsAfter(collectionId: number, lastSync?: Date): Promise<RaindropBookmark[]> {
		const notice = new Notice("Fetch Raindrops highlights", 0);
		let res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
			"page": 0,
			"sort": "-lastUpdate"
		});
		let raindropsCnt = res.count;
		let bookmarks = this.parseRaindrops(res.items);
		let remainPages = Math.ceil(raindropsCnt / 25) - 1;
		let totalPages = Math.ceil(raindropsCnt / 25) - 1;
		let page = 1;

		let addNewPages = async (page: number) => {
			let res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
				"page": page,
				"sort": "-lastUpdate"
			});
			bookmarks = bookmarks.concat(this.parseRaindrops(res.items));
		}

		if (bookmarks.length > 0) {
			if (lastSync === undefined) { // sync all
				while (remainPages--) {
					notice.setMessage(`Sync Raindrop pages: ${totalPages - remainPages}/${totalPages}`)
					await addNewPages(page++);
				}
			} else { // sync article after lastSync
				while (bookmarks[bookmarks.length - 1].lastUpdate >= lastSync && remainPages--) {
					notice.setMessage(`Sync Raindrop pages: ${totalPages - remainPages}/${totalPages}`)
					await addNewPages(page++);
				}
				bookmarks = bookmarks.filter(bookmark => {
					return bookmark.lastUpdate >= lastSync;
				});
			}
		}

		// get real highlights (raindrop returns only 3 highlights in /raindrops/${collectionId} endpoint)
		for (let [idx, bookmark] of bookmarks.entries()) {
			notice.setMessage(`Sync Raindrop bookmarks: ${idx + 1}/${bookmarks.length}`)
			if (bookmark.highlights.length == 3) {
				let res = await this.get(`${BASEURL}/raindrop/${bookmark.id}`, {});
				bookmark['highlights'] = this.parseHighlights(res.item.highlights);
			}
		}

		notice.hide();
		return bookmarks;
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

	async getRaindrop(id: number): Promise<RaindropBookmark> {
		const res = await this.get(`${BASEURL}/raindrop/${id}`, {});
		const bookmark = this.parseRaindrop(res.item);
		return bookmark;
	}

	private parseRaindrops(bookmarks: any): RaindropBookmark[] {
		return bookmarks.map((raindrop: any) => {
			return this.parseRaindrop(raindrop);
		});
	}

	private parseRaindrop(raindrop: any): RaindropBookmark {
		const bookmark: RaindropBookmark = {
			id: raindrop['_id'],
			collectionId: raindrop['collectionId'],
			title: raindrop['title'],
			highlights: this.parseHighlights(raindrop['highlights']),
			excerpt: raindrop['excerpt'],
			link: raindrop['link'],
			lastUpdate: new Date(raindrop['lastUpdate']),
			tags: raindrop['tags'],
			cover: raindrop['cover'],
			created: new Date(raindrop['created']),
			type: raindrop['type'],
			important: raindrop['important'],
			creator: {
				name: raindrop['creatorRef']['name'],
				id: raindrop['creatorRef']['_id'],
			},
		};
		return bookmark;
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
