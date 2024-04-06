import { Notice, type App } from "obsidian";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import type { RaindropBookmark, RaindropCollection, RaindropCollectionGroup, RaindropHighlight, RaindropUser } from "./types";
import TokenManager from "./tokenManager";
import { Md5 } from "ts-md5";

const BASEURL = "https://api.raindrop.io/rest/v1";

interface NestedRaindropCollection {
	title: string;
	parentId: number;
}

axiosRetry(axios, {
	retries: 3,
	retryCondition: (error: AxiosError) => {
		if (error.response && error.response.status === 429) {
			new Notice("Too many requests, will retry sync after 1 minute", 5);
			console.warn(`Too many requests, will retry sync after 1 minute`);
			return true;
		} else {
			console.error(`request error: ${error}`);
		}
		return false;
	},
	retryDelay: () => {
		return 60000;
	},
	onRetry: (retryCount) => {
		new Notice(`Retry sync ${retryCount}/3`);
	},
});

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
				Authorization: `Bearer ${token}`,
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

	async getCollections(enableCollectionGroup: boolean): Promise<RaindropCollection[]> {
		const rootCollectionPromise = this.get(`${BASEURL}/collections`, {});
		const nestedCollectionPromise = this.get(`${BASEURL}/collections/childrens`, {});

		const collections: RaindropCollection[] = [
			{ id: -1, title: "Unsorted" },
			{ id: 0, title: "All bookmarks" },
			{ id: -99, title: "Trash" },
		];

		const collectionGroupMap: { [id: number]: string } = {};
		if (enableCollectionGroup) {
			const res = await this.get(`${BASEURL}/user`, {});
			const groups = this.parseGroups(res.user.groups);
			groups.forEach((g) => {
				g.collections.forEach((cid) => {
					collectionGroupMap[cid] = g.title;
				});
			});
		}

		const rootCollectionMap: { [id: number]: string } = {};
		const rootCollections = await rootCollectionPromise;
		rootCollections.items.forEach((collection: any) => {
			const id = collection["_id"];
			let title = collection["title"];
			if (enableCollectionGroup) {
				title = `${collectionGroupMap[id]}/${title}`;
			}
			rootCollectionMap[id] = title;
			collections.push({
				title: title,
				id: id,
			});
		});

		const nestedCollectionMap: { [id: number]: NestedRaindropCollection } = {};
		const nestedCollections = await nestedCollectionPromise;
		nestedCollections.items.forEach((collection: any) => {
			const id = collection["_id"];
			nestedCollectionMap[id] = {
				title: collection["title"],
				parentId: collection["parent"]["$id"],
			};
		});

		nestedCollections.items.forEach((collection: any) => {
			const id = collection["_id"];
			let parentId = collection["parent"]["$id"];
			let title = collection["title"];
			while (parentId && parentId in nestedCollectionMap) {
				title = `${nestedCollectionMap[parentId].title}/${title}`;
				parentId = nestedCollectionMap[parentId].parentId;
			}
			if (parentId && parentId in rootCollectionMap) {
				title = `${rootCollectionMap[parentId]}/${title}`;
			}
			collections.push({
				title: title,
				id: id,
			});
		});

		return collections;
	}

	async *getRaindropsAfter(collectionId: number, showNotice: boolean, lastSync?: Date): AsyncGenerator<RaindropBookmark[]> {
		let notice;
		if (showNotice) {
			notice = new Notice("Fetch Raindrops highlights", 0);
		}

		const pageSize = 50;
		const res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
			page: 0,
			perpage: pageSize,
			// sort: "-lastUpdate",
		});
		const raindropsCnt = res.count;
		let bookmarks = this.parseRaindrops(res.items);
		const totalPages = Math.ceil(raindropsCnt / pageSize);
		let remainPages = totalPages - 1;
		let page = 1;

		const getPage = async (page: number) => {
			const res = await this.get(`${BASEURL}/raindrops/${collectionId}`, {
				page: page,
				perpage: pageSize,
				// sort: "-lastUpdate",
			});
			return this.parseRaindrops(res.items);
		};

		if (lastSync === undefined) {
			if (bookmarks.length > 0) {
				yield bookmarks;
				while (remainPages--) {
					notice?.setMessage(`Sync Raindrop pages: ${page + 1}/${totalPages}`);
					yield await getPage(page++);
				}
			}
		} else {
			const filterLastUpdate = (bookmarks: RaindropBookmark[]) => {
				return bookmarks.filter((bookmark) => {
					return bookmark.lastUpdate.getTime() >= lastSync.getTime();
				});
			};
			const filteredBookmark = filterLastUpdate(bookmarks);
			if (filteredBookmark.length > 0) {
				yield filteredBookmark;
				while (bookmarks[bookmarks.length - 1].lastUpdate.getTime() >= lastSync.getTime() && remainPages--) {
					notice?.setMessage(`Sync Raindrop pages: ${page + 1}/${totalPages}`);
					let bookmarks = await getPage(page++);
					yield filterLastUpdate(bookmarks);
				}
			}
		}

		notice?.hide();
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
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});
			if (result.status !== 200) {
				throw new Error("Invalid token");
			}
		} catch (e) {
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
			id: raindrop["_id"],
			collectionId: raindrop["collectionId"],
			title: raindrop["title"],
			highlights: this.parseHighlights(raindrop["highlights"]),
			excerpt: raindrop["excerpt"],
			note: raindrop["note"],
			link: raindrop["link"],
			lastUpdate: new Date(raindrop["lastUpdate"]),
			tags: raindrop["tags"],
			cover: raindrop["cover"],
			created: new Date(raindrop["created"]),
			type: raindrop["type"],
			important: raindrop["important"],
			creator: {
				name: raindrop["creatorRef"]["name"],
				id: raindrop["creatorRef"]["_id"],
			},
		};
		return bookmark;
	}

	private parseHighlights(highlights: any): RaindropHighlight[] {
		return highlights.map((hl: any) => {
			const highlight: RaindropHighlight = {
				id: hl["_id"],
				color: hl["color"],
				text: hl["text"],
				lastUpdate: new Date(hl["lastUpdate"]),
				created: new Date(hl["created"]),
				note: hl["note"],
				signature: Md5.hashStr(`${hl["color"]},${hl["text"]},${hl["note"]}`),
			};
			return highlight;
		});
	}

	private parseGroups(groups: any): RaindropCollectionGroup[] {
		return groups.map((g: any) => {
			const group: RaindropCollectionGroup = {
				title: g["title"],
				collections: g["collections"],
			};
			return group;
		});
	}
}
